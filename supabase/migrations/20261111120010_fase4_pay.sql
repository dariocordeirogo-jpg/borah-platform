-- Fase 4: LIVELANCE PAY (Stripe Connect, cobranças com destino na conta da loja)
-- O banco é a fonte da verdade: valor, comissão e status do pagamento só mudam aqui.
-- Avisos da Stripe (webhooks) são aceitos só com assinatura válida, conferida no próprio banco.

create type public.payment_status as enum ('created', 'processing', 'succeeded', 'failed', 'expired', 'refunded');

-- Configuração interna (schema private não é exposto pela API)
create table private.payment_settings (
  id boolean primary key default true check (id),
  platform_fee_bps integer not null default 1000 check (platform_fee_bps between 0 and 5000),
  webhook_tolerance_s integer not null default 300 check (webhook_tolerance_s between 60 and 3600),
  session_minutes integer not null default 60 check (session_minutes between 30 and 1440)
);
insert into private.payment_settings default values;

-- Conta de recebimento da loja (Stripe Connect). verified = confirmada por aviso assinado da Stripe.
create table public.store_payment_accounts (
  store_id uuid primary key references public.stores (id) on delete cascade,
  provider text not null default 'stripe' check (provider = 'stripe'),
  account_id text not null unique check (account_id ~ '^acct_[A-Za-z0-9]{6,64}$'),
  verified boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  requirements_due text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  buyer_id uuid not null references auth.users (id) on delete restrict,
  store_id uuid not null references public.stores (id) on delete restrict,
  provider text not null default 'stripe' check (provider = 'stripe'),
  destination_account text not null,
  amount_cents integer not null check (amount_cents > 0),
  fee_cents integer not null check (fee_cents >= 0 and fee_cents <= amount_cents),
  net_cents integer generated always as (amount_cents - fee_cents) stored,
  currency text not null default 'brl' check (currency = 'brl'),
  status public.payment_status not null default 'created',
  checkout_session_id text unique check (checkout_session_id ~ '^cs_(test|live)_[A-Za-z0-9]+$'),
  payment_intent_id text unique,
  needs_refund boolean not null default false,
  failure_reason text,
  expires_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id, created_at desc);
create index payments_buyer_idx on public.payments (buyer_id, created_at desc);
create index payments_store_idx on public.payments (store_id, created_at desc);
-- No máximo um pagamento em aberto e um pago por pedido
create unique index payments_one_open_per_order on public.payments (order_id) where status in ('created', 'processing');
create unique index payments_one_paid_per_order on public.payments (order_id) where status = 'succeeded';

-- Avisos recebidos (idempotência). Sem políticas: ninguém lê pela API.
create table public.payment_events (
  event_id text primary key,
  type text not null,
  livemode boolean not null default false,
  result text,
  received_at timestamptz not null default now()
);

create trigger store_payment_accounts_set_updated_at before update on public.store_payment_accounts for each row execute function private.set_updated_at();
create trigger payments_set_updated_at before update on public.payments for each row execute function private.set_updated_at();

alter table public.store_payment_accounts enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;

create policy "recebimento: dono da loja lê" on public.store_payment_accounts for select to authenticated
  using (store_id = (select private.my_store_id()));
create policy "pagamentos: comprador ou loja lê" on public.payments for select to authenticated
  using (buyer_id = (select auth.uid()) or store_id = (select private.my_store_id()));

-- Escrita só pelas funções abaixo
revoke insert, update, delete, truncate on public.store_payment_accounts, public.payments, public.payment_events from anon, authenticated;
revoke select on public.payment_events from anon, authenticated;

update public.feature_flags set description = 'Pagamentos reais (chave de produção da Stripe). Desligado = só modo de teste.'
where key = 'payments';

-- Comissão atual (para exibir; o cálculo vale só no banco)
create function public.platform_fee_bps() returns integer
language sql stable security definer set search_path = '' as $$
  select platform_fee_bps from private.payment_settings where id
$$;
grant execute on function public.platform_fee_bps() to anon, authenticated;

create function private.fee_for(_amount_cents integer) returns integer
language sql stable security definer set search_path = '' as $$
  select (round(_amount_cents::numeric * platform_fee_bps / 10000))::integer from private.payment_settings where id
$$;

-- Assinatura Stripe: cabeçalho "t=<unix>,v1=<hmac_sha256_hex>"; segredo no Vault (stripe_webhook_secret)
create function private.stripe_signature_ok(_payload text, _header text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  _secret text;
  _tol integer;
  _t text;
  _sigs text[] := '{}';
  _part text;
  _expected text;
begin
  select decrypted_secret into _secret from vault.decrypted_secrets where name = 'stripe_webhook_secret' limit 1;
  if _secret is null or length(_secret) < 16 then
    raise exception 'webhook_not_configured' using errcode = 'P0001';
  end if;
  select webhook_tolerance_s into _tol from private.payment_settings where id;
  foreach _part in array string_to_array(coalesce(_header, ''), ',') loop
    _part := btrim(_part);
    if _part like 't=%' then _t := substr(_part, 3);
    elsif _part like 'v1=%' then _sigs := array_append(_sigs, lower(substr(_part, 4)));
    end if;
  end loop;
  if _t is null or _t !~ '^[0-9]{1,12}$' or cardinality(_sigs) = 0 then return false; end if;
  if abs(extract(epoch from now()) - _t::bigint) > _tol then return false; end if;
  _expected := encode(extensions.hmac(convert_to(_t || '.' || _payload, 'UTF8'), convert_to(_secret, 'UTF8'), 'sha256'), 'hex');
  return _expected = any (_sigs);
end $$;

-- Devolve o estoque de um pedido e cancela (usado em reembolso)
create function private.cancel_order_with_restock(_order_id uuid, _reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.stock_reason', 'order_cancelled', true);
  perform set_config('app.stock_order', _order_id::text, true);
  update public.products p set stock = p.stock + i.quantity
  from public.order_items i where i.order_id = _order_id and i.product_id = p.id;
  perform set_config('app.stock_reason', '', true);
  perform set_config('app.stock_order', '', true);
  update public.orders set status = 'cancelled', cancelled_reason = left(_reason, 200) where id = _order_id;
end $$;

-- Sessão do Checkout (checkout.session.*)
create function private.apply_checkout_session(_s jsonb, _type text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _ref text := _s ->> 'client_reference_id';
  _p public.payments;
  _order public.orders;
  _paid boolean;
begin
  if _ref is null or _ref !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or coalesce(_s -> 'metadata' ->> 'payment_id', '') <> _ref then
    return jsonb_build_object('result', 'unknown_payment');
  end if;
  select * into _p from public.payments where id = _ref::uuid for update;
  if _p.id is null then return jsonb_build_object('result', 'unknown_payment'); end if;
  if _p.checkout_session_id is not null and _p.checkout_session_id <> (_s ->> 'id') then
    return jsonb_build_object('result', 'session_mismatch');
  end if;
  if _p.checkout_session_id is null and (_s ->> 'id') ~ '^cs_(test|live)_[A-Za-z0-9]+$' then
    update public.payments set checkout_session_id = _s ->> 'id' where id = _p.id;
  end if;

  _paid := (_type = 'checkout.session.completed' and _s ->> 'payment_status' = 'paid')
           or _type = 'checkout.session.async_payment_succeeded';

  if _paid then
    if _p.status in ('succeeded', 'refunded') then return jsonb_build_object('result', 'already_paid'); end if;
    if (_s ->> 'amount_total')::bigint is distinct from _p.amount_cents or lower(_s ->> 'currency') <> _p.currency then
      update public.payments set status = 'failed', failure_reason = 'amount_mismatch', needs_refund = true,
        payment_intent_id = coalesce(payment_intent_id, _s ->> 'payment_intent')
      where id = _p.id;
      return jsonb_build_object('result', 'amount_mismatch', 'action', 'refund', 'payment_intent', _s ->> 'payment_intent');
    end if;

    select * into _order from public.orders where id = _p.order_id for update;
    if _order.status = 'pending_payment'
       and not exists (select 1 from public.payments x where x.order_id = _p.order_id and x.status = 'succeeded') then
      update public.payments set status = 'succeeded', paid_at = now(), failure_reason = null,
        payment_intent_id = _s ->> 'payment_intent'
      where id = _p.id;
      update public.orders set status = 'paid' where id = _p.order_id;
      insert into public.audit_logs (actor_id, action, entity, entity_id, data)
      values (null, 'order.paid', 'order', _p.order_id::text, jsonb_build_object('payment_id', _p.id, 'amount_cents', _p.amount_cents));
      return jsonb_build_object('result', 'paid');
    end if;
    -- Pagou um pedido que não aceita mais pagamento (cancelado ou já pago): devolver
    update public.payments set status = 'failed', failure_reason = 'order_not_payable', needs_refund = true,
      payment_intent_id = _s ->> 'payment_intent'
    where id = _p.id;
    return jsonb_build_object('result', 'order_not_payable', 'action', 'refund', 'payment_intent', _s ->> 'payment_intent');
  end if;

  if _type = 'checkout.session.completed' then  -- Pix/boleto gerado, aguardando
    if _p.status = 'created' then
      update public.payments set status = 'processing', payment_intent_id = _s ->> 'payment_intent' where id = _p.id;
    end if;
    return jsonb_build_object('result', 'processing');
  elsif _type = 'checkout.session.async_payment_failed' then
    if _p.status in ('created', 'processing') then
      update public.payments set status = 'failed', failure_reason = 'async_payment_failed' where id = _p.id;
    end if;
    return jsonb_build_object('result', 'failed');
  elsif _type = 'checkout.session.expired' then
    if _p.status in ('created', 'processing') then
      update public.payments set status = 'expired' where id = _p.id;
    end if;
    return jsonb_build_object('result', 'expired');
  end if;
  return jsonb_build_object('result', 'ignored');
end $$;

-- Conta conectada (account.updated). Só vale para a conta já registrada pela própria loja.
create function private.apply_account(_a jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _store text := _a -> 'metadata' ->> 'store_id';
  _n integer;
begin
  if _store is null or _store !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('result', 'unknown_account');
  end if;
  update public.store_payment_accounts set
    verified = true,
    charges_enabled = coalesce((_a ->> 'charges_enabled')::boolean, false),
    payouts_enabled = coalesce((_a ->> 'payouts_enabled')::boolean, false),
    details_submitted = coalesce((_a ->> 'details_submitted')::boolean, false),
    requirements_due = coalesce(array(select jsonb_array_elements_text(_a -> 'requirements' -> 'currently_due')), '{}')
  where store_id = _store::uuid and account_id = _a ->> 'id';
  get diagnostics _n = row_count;
  return jsonb_build_object('result', case when _n = 1 then 'account_updated' else 'unknown_account' end);
end $$;

-- Reembolso total (charge.refunded): pagamento reembolsado; pedido ainda não enviado é cancelado com estoque devolvido
create function private.apply_refund(_c jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _p public.payments;
  _status public.order_status;
begin
  if not coalesce((_c ->> 'refunded')::boolean, false) then return jsonb_build_object('result', 'partial_refund_ignored'); end if;
  select * into _p from public.payments where payment_intent_id = _c ->> 'payment_intent' for update;
  if _p.id is null then return jsonb_build_object('result', 'unknown_payment'); end if;
  if _p.status = 'refunded' then return jsonb_build_object('result', 'already_refunded'); end if;
  update public.payments set status = case when status = 'succeeded' then 'refunded'::public.payment_status else status end,
    refunded_at = now(), needs_refund = false
  where id = _p.id;
  if _p.status = 'succeeded' then
    select status into _status from public.orders where id = _p.order_id for update;
    if _status = 'paid' then
      perform private.cancel_order_with_restock(_p.order_id, 'Pagamento reembolsado');
    end if;
    insert into public.audit_logs (actor_id, action, entity, entity_id) values (null, 'order.refunded', 'order', _p.order_id::text);
  end if;
  return jsonb_build_object('result', 'refunded');
end $$;

-- Entrada única dos avisos da Stripe. Chamável sem login: quem autentica é a assinatura.
create function public.stripe_ingest_event(_payload text, _signature text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _evt jsonb;
  _id text;
  _type text;
  _live boolean;
  _res jsonb;
begin
  if length(_payload) > 524288 then raise exception 'payload_too_large' using errcode = 'P0001'; end if;
  if not private.stripe_signature_ok(_payload, _signature) then
    raise exception 'invalid_signature' using errcode = '28000';
  end if;
  _evt := _payload::jsonb;
  _id := _evt ->> 'id';
  _type := _evt ->> 'type';
  _live := coalesce((_evt ->> 'livemode')::boolean, false);
  if _id is null or _type is null then raise exception 'invalid_event' using errcode = 'P0001'; end if;

  insert into public.payment_events (event_id, type, livemode) values (_id, _type, _live) on conflict do nothing;
  if not found then return jsonb_build_object('duplicate', true); end if;

  -- Produção só com autorização explícita (flag payments)
  if _live and not coalesce((select enabled from public.feature_flags where key = 'payments'), false) then
    _res := jsonb_build_object('result', 'livemode_disabled');
  elsif _type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded',
                  'checkout.session.async_payment_failed', 'checkout.session.expired') then
    _res := private.apply_checkout_session(_evt -> 'data' -> 'object', _type);
  elsif _type = 'account.updated' then
    _res := private.apply_account(_evt -> 'data' -> 'object');
  elsif _type = 'charge.refunded' then
    _res := private.apply_refund(_evt -> 'data' -> 'object');
  else
    _res := jsonb_build_object('result', 'ignored');
  end if;

  update public.payment_events set result = _res ->> 'result' where event_id = _id;
  return _res || jsonb_build_object('duplicate', false);
end $$;
revoke execute on function public.stripe_ingest_event(text, text) from public;
grant execute on function public.stripe_ingest_event(text, text) to anon, authenticated;

-- Comprador inicia o pagamento de um pedido. Valor e comissão saem daqui.
create function public.start_order_payment(_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _o record;
  _acct public.store_payment_accounts;
  _p public.payments;
  _minutes integer;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select o.*, s.name as store_name into _o from public.orders o join public.stores s on s.id = o.store_id
  where o.id = _order_id for update of o;
  if _o.id is null or _o.buyer_id <> _uid then raise exception 'order_not_found' using errcode = 'P0001'; end if;
  if _o.status <> 'pending_payment' then raise exception 'order_not_payable' using errcode = 'P0001'; end if;

  select * into _acct from public.store_payment_accounts where store_id = _o.store_id;
  if _acct.store_id is null or not _acct.verified or not _acct.charges_enabled then
    raise exception 'store_cannot_receive' using errcode = 'P0001';
  end if;

  update public.payments set status = 'expired'
  where order_id = _order_id and status = 'created' and expires_at is not null and expires_at <= now();

  select * into _p from public.payments where order_id = _order_id and status in ('created', 'processing');
  if _p.id is not null then
    if _p.status = 'processing' then raise exception 'payment_processing' using errcode = 'P0001'; end if;
    if _p.amount_cents = _o.total_cents and _p.destination_account = _acct.account_id then
      return jsonb_build_object('payment_id', _p.id, 'session_id', _p.checkout_session_id,
        'amount_cents', _p.amount_cents, 'fee_cents', _p.fee_cents, 'destination', _p.destination_account,
        'order_number', _o.number, 'store_name', _o.store_name);
    end if;
    update public.payments set status = 'expired', failure_reason = 'superseded' where id = _p.id;
  end if;

  select session_minutes into _minutes from private.payment_settings where id;
  insert into public.payments (order_id, buyer_id, store_id, destination_account, amount_cents, fee_cents, expires_at)
  values (_order_id, _uid, _o.store_id, _acct.account_id, _o.total_cents, private.fee_for(_o.total_cents),
          now() + make_interval(mins => _minutes))
  returning * into _p;
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (_uid, 'payment.start', 'payment', _p.id::text);
  return jsonb_build_object('payment_id', _p.id, 'session_id', null,
    'amount_cents', _p.amount_cents, 'fee_cents', _p.fee_cents, 'destination', _p.destination_account,
    'order_number', _o.number, 'store_name', _o.store_name);
end $$;
revoke execute on function public.start_order_payment(uuid) from public, anon;
grant execute on function public.start_order_payment(uuid) to authenticated;

-- Guarda o id da sessão criada pelo servidor (uma vez só)
create function public.attach_checkout_session(_payment_id uuid, _session_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare _uid uuid := auth.uid(); _n integer;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if _session_id !~ '^cs_(test|live)_[A-Za-z0-9]+$' then raise exception 'invalid_session' using errcode = 'P0001'; end if;
  update public.payments set checkout_session_id = _session_id
  where id = _payment_id and buyer_id = _uid and status = 'created' and checkout_session_id is null;
  get diagnostics _n = row_count;
  if _n = 0 then raise exception 'payment_not_found' using errcode = 'P0001'; end if;
end $$;
revoke execute on function public.attach_checkout_session(uuid, text) from public, anon;
grant execute on function public.attach_checkout_session(uuid, text) to authenticated;

-- Loja registra a conta Stripe criada pelo servidor. Fica "não verificada" até o aviso assinado.
create function public.register_payout_account(_account_id text) returns text
language plpgsql security definer set search_path = '' as $$
declare _store uuid := private.my_store_id(); _existing text;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if _store is null then raise exception 'store_required' using errcode = 'P0001'; end if;
  select account_id into _existing from public.store_payment_accounts where store_id = _store;
  if _existing is not null then return _existing; end if;
  if _account_id !~ '^acct_[A-Za-z0-9]{6,64}$' then raise exception 'invalid_account' using errcode = 'P0001'; end if;
  insert into public.store_payment_accounts (store_id, account_id) values (_store, _account_id);
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (auth.uid(), 'payout_account.register', 'store', _store::text);
  return _account_id;
end $$;
revoke execute on function public.register_payout_account(text) from public, anon;
grant execute on function public.register_payout_account(text) to authenticated;

-- Pedido com Pix/boleto em processamento não pode ser cancelado; sessões abertas expiram junto
create or replace function public.cancel_order(_order_id uuid, _reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _o record;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select o.*, s.owner_id into _o from public.orders o join public.stores s on s.id = o.store_id
  where o.id = _order_id for update of o;
  if _o.id is null or (_o.buyer_id <> _uid and _o.owner_id <> _uid) then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if _o.status <> 'pending_payment' then
    raise exception 'order_not_cancellable' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payments where order_id = _order_id and status = 'processing') then
    raise exception 'payment_processing' using errcode = 'P0001';
  end if;
  update public.payments set status = 'expired', failure_reason = 'order_cancelled'
  where order_id = _order_id and status = 'created';

  perform private.cancel_order_with_restock(_order_id, coalesce(_reason,
    case when _o.buyer_id = _uid then 'Cancelado pelo comprador' else 'Cancelado pela loja' end));
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (_uid, 'order.cancel', 'order', _order_id::text);
end $$;

revoke execute on function private.fee_for(integer), private.stripe_signature_ok(text, text),
  private.cancel_order_with_restock(uuid, text), private.apply_checkout_session(jsonb, text),
  private.apply_account(jsonb), private.apply_refund(jsonb) from public, anon, authenticated;
