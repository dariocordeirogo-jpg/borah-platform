-- ZEXI PAY: pagamento único do carrinho com Compra Garantida (Zexi intermedia).
-- O comprador paga todos os pedidos (um por loja) numa cobrança só, feita na conta da Zexi.
-- O dinheiro de cada loja fica retido até a entrega; depois sai uma transferência para a conta da loja,
-- já sem a comissão. Reembolso é por loja (parcial). Tudo decidido aqui, em transação.
-- Pagamentos antigos (cobrança direta na conta da loja) continuam funcionando como antes.

alter table private.payment_settings
  add column payout_hold_days integer not null default 0 check (payout_hold_days between 0 and 30),
  add column payout_max_attempts integer not null default 8 check (payout_max_attempts between 1 and 50);

-- Uma cobrança por carrinho (agrupa os pagamentos de cada pedido)
create table public.checkout_payments (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'brl' check (currency = 'brl'),
  status public.payment_status not null default 'created',
  checkout_session_id text unique check (checkout_session_id ~ '^cs_(test|live)_[A-Za-z0-9]+$'),
  payment_intent_id text unique,
  needs_refund boolean not null default false,
  failure_reason text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index checkout_payments_buyer_idx on public.checkout_payments (buyer_id, created_at desc);
create trigger checkout_payments_set_updated_at before update on public.checkout_payments
  for each row execute function private.set_updated_at();
alter table public.checkout_payments enable row level security;
create policy "cobranças: comprador lê" on public.checkout_payments for select to authenticated
  using (buyer_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.checkout_payments from anon, authenticated;

-- Parte de cada loja dentro da cobrança + situação do repasse
alter table public.payments
  add column checkout_payment_id uuid references public.checkout_payments (id) on delete restrict,
  add column payout_status text not null default 'none'
    check (payout_status in ('none', 'held', 'ready', 'processing', 'transferred', 'cancelled')),
  add column payout_ready_at timestamptz,
  add column payout_claimed_at timestamptz,
  add column payout_attempts integer not null default 0,
  add column payout_error text,
  add column transfer_id text unique,
  add column transferred_at timestamptz;
create index payments_checkout_idx on public.payments (checkout_payment_id) where checkout_payment_id is not null;
create index payments_payout_due_idx on public.payments (payout_ready_at) where payout_status in ('ready', 'processing');

-- Expira cobranças em aberto (e as partes delas) que contêm algum destes pedidos
create function private.expire_open_checkouts(_order_ids uuid[], _reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.checkout_payments g set status = 'expired', failure_reason = _reason
  where g.status = 'created'
    and exists (select 1 from public.payments p where p.checkout_payment_id = g.id and p.order_id = any (_order_ids));
  update public.payments p set status = 'expired', failure_reason = _reason
  from public.checkout_payments g
  where p.checkout_payment_id = g.id and g.status = 'expired' and p.status = 'created';
end $$;

-- Comprador inicia o pagamento de um ou mais pedidos (um por loja). Valores e comissões saem daqui.
create function public.start_cart_payment(_order_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _ids uuid[];
  _n integer;
  _o record;
  _acct public.store_payment_accounts;
  _g public.checkout_payments;
  _total bigint := 0;
  _minutes integer;
  _orders jsonb := '[]'::jsonb;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select array_agg(distinct x order by x) into _ids from unnest(_order_ids) x where x is not null;
  _n := coalesce(cardinality(_ids), 0);
  if _n = 0 or _n > 20 then raise exception 'order_not_found' using errcode = 'P0001'; end if;

  -- Trava os pedidos (sempre na mesma ordem) e confere cada um
  for _o in
    select o.id, o.buyer_id, o.status, o.total_cents, o.number, o.store_id, s.name as store_name
    from public.orders o join public.stores s on s.id = o.store_id
    where o.id = any (_ids) order by o.id for update of o
  loop
    if _o.buyer_id <> _uid then raise exception 'order_not_found' using errcode = 'P0001'; end if;
    if _o.status <> 'pending_payment' then raise exception 'order_not_payable' using errcode = 'P0001'; end if;
    select * into _acct from public.store_payment_accounts where store_id = _o.store_id;
    if _acct.store_id is null or not _acct.verified or not _acct.charges_enabled then
      raise exception 'store_cannot_receive' using errcode = 'P0001';
    end if;
    _total := _total + _o.total_cents;
    _orders := _orders || jsonb_build_object('order_id', _o.id, 'number', _o.number, 'store_name', _o.store_name,
      'amount_cents', _o.total_cents);
  end loop;
  if jsonb_array_length(_orders) <> _n then raise exception 'order_not_found' using errcode = 'P0001'; end if;

  -- Pagamentos vencidos saem do caminho
  update public.payments set status = 'expired'
  where order_id = any (_ids) and status = 'created' and expires_at is not null and expires_at <= now();
  update public.checkout_payments g set status = 'expired'
  where g.buyer_id = _uid and g.status = 'created' and g.expires_at <= now();

  if exists (select 1 from public.payments where order_id = any (_ids) and status = 'processing') then
    raise exception 'payment_processing' using errcode = 'P0001';
  end if;

  -- Mesma cobrança em aberto para exatamente estes pedidos e valores: reaproveita (mesma sessão do Checkout)
  select g.* into _g from public.checkout_payments g
  where g.buyer_id = _uid and g.status = 'created' and g.amount_cents = _total
    and (select array_agg(p.order_id order by p.order_id) from public.payments p
         where p.checkout_payment_id = g.id and p.status = 'created') = _ids
    and not exists (select 1 from public.payments p join public.orders o on o.id = p.order_id
                    where p.checkout_payment_id = g.id and p.amount_cents <> o.total_cents)
  order by g.created_at desc limit 1;
  if _g.id is not null then
    return jsonb_build_object('checkout_payment_id', _g.id, 'session_id', _g.checkout_session_id,
      'amount_cents', _g.amount_cents, 'orders', _orders);
  end if;

  -- Qualquer outra tentativa em aberto destes pedidos é substituída
  perform private.expire_open_checkouts(_ids, 'superseded');
  update public.payments set status = 'expired', failure_reason = 'superseded'
  where order_id = any (_ids) and status = 'created';

  select session_minutes into _minutes from private.payment_settings where id;
  insert into public.checkout_payments (buyer_id, amount_cents, expires_at)
  values (_uid, _total, now() + make_interval(mins => _minutes))
  returning * into _g;

  insert into public.payments (order_id, buyer_id, store_id, destination_account, amount_cents, fee_cents, expires_at,
    checkout_payment_id)
  select o.id, _uid, o.store_id, a.account_id, o.total_cents, private.fee_for(o.total_cents), _g.expires_at, _g.id
  from public.orders o join public.store_payment_accounts a on a.store_id = o.store_id
  where o.id = any (_ids);

  insert into public.audit_logs (actor_id, action, entity, entity_id, data)
  values (_uid, 'payment.cart_start', 'checkout_payment', _g.id::text, jsonb_build_object('orders', _n, 'amount_cents', _total));
  return jsonb_build_object('checkout_payment_id', _g.id, 'session_id', null, 'amount_cents', _total, 'orders', _orders);
end $$;
revoke execute on function public.start_cart_payment(uuid[]) from public, anon;
grant execute on function public.start_cart_payment(uuid[]) to authenticated;

-- Guarda o id da sessão do Checkout criada pelo servidor (uma vez só)
create function public.attach_cart_session(_checkout_payment_id uuid, _session_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare _uid uuid := auth.uid(); _n integer;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if _session_id !~ '^cs_(test|live)_[A-Za-z0-9]+$' then raise exception 'invalid_session' using errcode = 'P0001'; end if;
  update public.checkout_payments set checkout_session_id = _session_id
  where id = _checkout_payment_id and buyer_id = _uid and status = 'created' and checkout_session_id is null;
  get diagnostics _n = row_count;
  if _n = 0 then raise exception 'payment_not_found' using errcode = 'P0001'; end if;
end $$;
revoke execute on function public.attach_cart_session(uuid, text) from public, anon;
grant execute on function public.attach_cart_session(uuid, text) to authenticated;

-- Sessão do Checkout da cobrança única (acontece na conta da Zexi: aviso sem "account")
create function private.apply_cart_session(_s jsonb, _type text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _ref text := _s ->> 'client_reference_id';
  _g public.checkout_payments;
  _p public.payments;
  _order public.orders;
  _paid boolean;
  _pi text := _s ->> 'payment_intent';
  _refunds jsonb := '[]'::jsonb;
  _ok integer := 0;
begin
  if _ref is null or _ref !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or coalesce(_s -> 'metadata' ->> 'checkout_payment_id', '') <> _ref then
    return jsonb_build_object('result', 'unknown_payment');
  end if;
  select * into _g from public.checkout_payments where id = _ref::uuid for update;
  if _g.id is null then return jsonb_build_object('result', 'unknown_payment'); end if;
  if _g.checkout_session_id is not null and _g.checkout_session_id <> (_s ->> 'id') then
    return jsonb_build_object('result', 'session_mismatch');
  end if;
  if _g.checkout_session_id is null and (_s ->> 'id') ~ '^cs_(test|live)_[A-Za-z0-9]+$' then
    update public.checkout_payments set checkout_session_id = _s ->> 'id' where id = _g.id;
  end if;

  _paid := (_type = 'checkout.session.completed' and _s ->> 'payment_status' = 'paid')
           or _type = 'checkout.session.async_payment_succeeded';

  if _paid then
    if _g.status in ('succeeded', 'refunded') then return jsonb_build_object('result', 'already_paid'); end if;
    if (_s ->> 'amount_total')::bigint is distinct from _g.amount_cents or lower(_s ->> 'currency') <> _g.currency then
      update public.checkout_payments set status = 'failed', failure_reason = 'amount_mismatch', needs_refund = true,
        payment_intent_id = coalesce(payment_intent_id, _pi)
      where id = _g.id;
      update public.payments set status = 'failed', failure_reason = 'amount_mismatch'
      where checkout_payment_id = _g.id and status in ('created', 'processing');
      return jsonb_build_object('result', 'amount_mismatch', 'action', 'refund', 'payment_intent', _pi);
    end if;

    update public.checkout_payments set status = 'succeeded', paid_at = now(), failure_reason = null,
      payment_intent_id = _pi
    where id = _g.id;

    for _p in select * from public.payments where checkout_payment_id = _g.id order by order_id for update loop
      select * into _order from public.orders where id = _p.order_id for update;
      if _order.status = 'pending_payment'
         and not exists (select 1 from public.payments x where x.order_id = _p.order_id and x.status = 'succeeded') then
        update public.payments set status = 'succeeded', paid_at = now(), failure_reason = null, payout_status = 'held'
        where id = _p.id;
        update public.orders set status = 'paid' where id = _p.order_id;
        insert into public.audit_logs (actor_id, action, entity, entity_id, data)
        values (null, 'order.paid', 'order', _p.order_id::text,
          jsonb_build_object('payment_id', _p.id, 'checkout_payment_id', _g.id, 'amount_cents', _p.amount_cents));
        _ok := _ok + 1;
      else
        -- Pedido que não aceita mais pagamento (cancelado ou já pago): devolve só a parte dele
        update public.payments set status = 'failed', failure_reason = 'order_not_payable', needs_refund = true
        where id = _p.id;
        _refunds := _refunds || jsonb_build_object('payment_id', _p.id, 'amount_cents', _p.amount_cents);
      end if;
    end loop;

    if jsonb_array_length(_refunds) > 0 then
      return jsonb_build_object('result', case when _ok > 0 then 'partially_paid' else 'order_not_payable' end,
        'action', 'refund_parts', 'payment_intent', _pi, 'refunds', _refunds);
    end if;
    return jsonb_build_object('result', 'paid');
  end if;

  if _type = 'checkout.session.completed' then  -- Pix/boleto gerado, aguardando o banco
    if _g.status = 'created' then
      update public.checkout_payments set status = 'processing', payment_intent_id = _pi where id = _g.id;
      update public.payments set status = 'processing' where checkout_payment_id = _g.id and status = 'created';
    end if;
    return jsonb_build_object('result', 'processing');
  elsif _type = 'checkout.session.async_payment_failed' then
    if _g.status in ('created', 'processing') then
      update public.checkout_payments set status = 'failed', failure_reason = 'async_payment_failed' where id = _g.id;
      update public.payments set status = 'failed', failure_reason = 'async_payment_failed'
      where checkout_payment_id = _g.id and status in ('created', 'processing');
    end if;
    return jsonb_build_object('result', 'failed');
  elsif _type = 'checkout.session.expired' then
    if _g.status in ('created', 'processing') then
      update public.checkout_payments set status = 'expired' where id = _g.id;
      update public.payments set status = 'expired'
      where checkout_payment_id = _g.id and status in ('created', 'processing');
    end if;
    return jsonb_build_object('result', 'expired');
  end if;
  return jsonb_build_object('result', 'ignored');
end $$;

-- Parte de uma loja devolvida ao comprador: pedido pago (ainda não enviado) é cancelado e o estoque volta
create function private.refund_part(_p public.payments, _reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare _status public.order_status;
begin
  if _p.status = 'succeeded' then
    update public.payments set status = 'refunded', refunded_at = now(), needs_refund = false,
      payout_status = case when payout_status = 'transferred' then payout_status else 'cancelled' end
    where id = _p.id;
    select status into _status from public.orders where id = _p.order_id for update;
    if _status = 'paid' then
      perform private.cancel_order_with_restock(_p.order_id, _reason);
    end if;
    insert into public.audit_logs (actor_id, action, entity, entity_id, data)
    values (null, 'order.refunded', 'order', _p.order_id::text, jsonb_build_object('payment_id', _p.id));
  else
    update public.payments set needs_refund = false, refunded_at = now() where id = _p.id;
  end if;
end $$;

-- Reembolso criado pela Zexi (refund.created/updated/failed), sempre com o pagamento da loja na metadata
create function private.apply_cart_refund(_r jsonb, _type text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _ref text := _r -> 'metadata' ->> 'payment_id';
  _p public.payments;
  _g public.checkout_payments;
begin
  if _ref is null or _ref !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('result', 'ignored');
  end if;
  select * into _p from public.payments where id = _ref::uuid for update;
  if _p.id is null or _p.checkout_payment_id is null then return jsonb_build_object('result', 'unknown_payment'); end if;
  select * into _g from public.checkout_payments where id = _p.checkout_payment_id for update;
  if _g.payment_intent_id is distinct from (_r ->> 'payment_intent') or (_r ->> 'amount')::bigint is distinct from _p.amount_cents then
    return jsonb_build_object('result', 'refund_mismatch');
  end if;
  if _type = 'refund.failed' or _r ->> 'status' in ('failed', 'canceled') then
    update public.payments set needs_refund = true where id = _p.id and status <> 'refunded';
    return jsonb_build_object('result', 'refund_failed');
  end if;
  if _r ->> 'status' not in ('succeeded', 'pending') then return jsonb_build_object('result', 'ignored'); end if;
  if _p.status = 'refunded' or (_p.status <> 'succeeded' and not _p.needs_refund) then
    return jsonb_build_object('result', 'already_refunded');
  end if;
  perform private.refund_part(_p, 'Pagamento devolvido ao comprador');
  if not exists (select 1 from public.payments where checkout_payment_id = _g.id and status = 'succeeded') then
    update public.checkout_payments set status = 'refunded', needs_refund = false where id = _g.id and status = 'succeeded';
  end if;
  return jsonb_build_object('result', 'refunded');
end $$;

-- Reembolso total feito fora da Zexi (painel da Stripe): devolve todas as partes ainda não repassadas
create function private.apply_cart_charge_refunded(_c jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _g public.checkout_payments;
  _p public.payments;
begin
  select * into _g from public.checkout_payments where payment_intent_id = _c ->> 'payment_intent' for update;
  if _g.id is null then return jsonb_build_object('result', 'unknown_payment'); end if;
  if not coalesce((_c ->> 'refunded')::boolean, false) then return jsonb_build_object('result', 'partial_refund_ignored'); end if;
  for _p in select * from public.payments where checkout_payment_id = _g.id order by order_id for update loop
    if _p.status = 'succeeded' or _p.needs_refund then
      perform private.refund_part(_p, 'Pagamento reembolsado');
    end if;
  end loop;
  update public.checkout_payments set status = case when status = 'succeeded' then 'refunded'::public.payment_status else status end,
    needs_refund = false
  where id = _g.id;
  return jsonb_build_object('result', 'refunded');
end $$;

-- Transferência para a loja (transfer.created, da Stripe ou sincronizada pelo servidor)
create function private.apply_transfer(_t jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _ref text := _t -> 'metadata' ->> 'payment_id';
  _p public.payments;
begin
  if _ref is null or _ref !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('result', 'ignored');
  end if;
  select * into _p from public.payments where id = _ref::uuid for update;
  if _p.id is null or _p.checkout_payment_id is null then return jsonb_build_object('result', 'unknown_payment'); end if;
  if _p.payout_status = 'transferred' then return jsonb_build_object('result', 'already_transferred'); end if;
  if (_t ->> 'destination') is distinct from _p.destination_account or (_t ->> 'amount')::bigint is distinct from _p.net_cents
     or (_t ->> 'transfer_group') is distinct from ('cp_' || _p.checkout_payment_id) then
    insert into public.audit_logs (actor_id, action, entity, entity_id, data)
    values (null, 'payout.mismatch', 'payment', _p.id::text, jsonb_build_object('transfer', _t ->> 'id'));
    return jsonb_build_object('result', 'transfer_mismatch');
  end if;
  update public.payments set payout_status = 'transferred', transfer_id = _t ->> 'id', transferred_at = now(),
    payout_error = null
  where id = _p.id;
  insert into public.audit_logs (actor_id, action, entity, entity_id, data)
  values (null, 'payout.transferred', 'payment', _p.id::text, jsonb_build_object('amount_cents', _p.net_cents));
  return jsonb_build_object('result', 'transferred');
end $$;

-- Tentativa de repasse que falhou (aviso interno assinado pelo servidor): volta para a fila
create function private.apply_payout_failed(_f jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare _ref text := _f ->> 'payment_id'; _n integer;
begin
  if _ref is null or _ref !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('result', 'ignored');
  end if;
  update public.payments set payout_status = 'ready', payout_claimed_at = null, payout_error = left(_f ->> 'error', 300)
  where id = _ref::uuid and payout_status = 'processing';
  get diagnostics _n = row_count;
  return jsonb_build_object('result', case when _n = 1 then 'payout_retry' else 'ignored' end);
end $$;

-- Entrega confirmada (comprador ou prazo): libera o repasse da loja
create function private.release_payout_on_delivery() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    update public.payments set payout_status = 'ready', payout_ready_at = now()
    where order_id = new.id and status = 'succeeded' and payout_status = 'held';
  end if;
  return null;
end $$;
create trigger orders_release_payout after update of status on public.orders
  for each row execute function private.release_payout_on_delivery();

-- Fila de repasses: o servidor pede (com aviso assinado) os repasses vencidos e marca como "processando"
create function public.claim_payouts(_payload text, _signature text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _req jsonb;
  _limit integer;
  _hold integer;
  _max integer;
  _out jsonb;
begin
  if length(_payload) > 4096 then raise exception 'payload_too_large' using errcode = 'P0001'; end if;
  if not private.stripe_signature_ok(_payload, _signature) then
    raise exception 'invalid_signature' using errcode = '28000';
  end if;
  _req := _payload::jsonb;
  if _req ->> 'kind' is distinct from 'zexi.payout.claim' then raise exception 'invalid_request' using errcode = 'P0001'; end if;
  _limit := least(greatest(coalesce((_req ->> 'limit')::integer, 20), 1), 50);
  select payout_hold_days, payout_max_attempts into _hold, _max from private.payment_settings where id;

  with due as (
    select p.id from public.payments p
    where p.checkout_payment_id is not null and p.status = 'succeeded' and p.payout_attempts < _max
      and ((p.payout_status = 'ready' and p.payout_ready_at <= now() - make_interval(days => _hold))
        or (p.payout_status = 'processing' and p.payout_claimed_at < now() - interval '15 minutes'))
    order by p.payout_ready_at
    limit _limit
    for update of p skip locked
  ), claimed as (
    update public.payments p set payout_status = 'processing', payout_claimed_at = now(), payout_attempts = p.payout_attempts + 1
    from due where p.id = due.id
    returning p.id, p.net_cents, p.destination_account, p.checkout_payment_id, p.order_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'payment_id', c.id, 'amount_cents', c.net_cents, 'destination', c.destination_account,
      'payment_intent', g.payment_intent_id, 'transfer_group', 'cp_' || g.id, 'order_number', o.number)), '[]'::jsonb)
  into _out
  from claimed c join public.checkout_payments g on g.id = c.checkout_payment_id join public.orders o on o.id = c.order_id;
  return _out;
end $$;
revoke execute on function public.claim_payouts(text, text) from public;
grant execute on function public.claim_payouts(text, text) to anon, authenticated;

-- Loja cancela uma venda paga e ainda não enviada: o banco marca a devolução da parte dela
create function public.request_order_refund(_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _o public.orders;
  _p public.payments;
  _g public.checkout_payments;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into _o from public.orders where id = _order_id for update;
  if _o.id is null or _o.store_id is distinct from private.my_store_id() then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if _o.status <> 'paid' then raise exception 'order_not_refundable' using errcode = 'P0001'; end if;
  select * into _p from public.payments where order_id = _order_id and status = 'succeeded' for update;
  if _p.id is null or _p.checkout_payment_id is null or _p.payout_status not in ('held', 'ready') then
    raise exception 'order_not_refundable' using errcode = 'P0001';
  end if;
  select * into _g from public.checkout_payments where id = _p.checkout_payment_id;
  update public.payments set needs_refund = true, payout_status = 'cancelled' where id = _p.id;
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (_uid, 'order.refund_requested', 'order', _order_id::text);
  return jsonb_build_object('payment_id', _p.id, 'payment_intent', _g.payment_intent_id, 'amount_cents', _p.amount_cents);
end $$;
revoke execute on function public.request_order_refund(uuid) from public, anon;
grant execute on function public.request_order_refund(uuid) to authenticated;

-- Entrada única dos avisos: cobrança única (sem "account"), cobrança direta antiga (com "account"),
-- reembolsos e transferências
create or replace function public.stripe_ingest_event(_payload text, _signature text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _evt jsonb;
  _obj jsonb;
  _id text;
  _type text;
  _live boolean;
  _account text;
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
  _account := _evt ->> 'account';  -- só vem em eventos de contas conectadas (cobrança direta antiga)
  _obj := _evt -> 'data' -> 'object';
  if _id is null or _type is null then raise exception 'invalid_event' using errcode = 'P0001'; end if;

  insert into public.payment_events (event_id, type, livemode) values (_id, _type, _live) on conflict do nothing;
  if not found then return jsonb_build_object('duplicate', true); end if;

  -- Produção só com autorização explícita (flag payments)
  if _live and not coalesce((select enabled from public.feature_flags where key = 'payments'), false) then
    _res := jsonb_build_object('result', 'livemode_disabled');
  elsif _type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded',
                  'checkout.session.async_payment_failed', 'checkout.session.expired') then
    if _account is null and _obj -> 'metadata' ? 'checkout_payment_id' then
      _res := private.apply_cart_session(_obj, _type);
    else
      _res := private.apply_checkout_session_v2(_obj, _type, _account);
    end if;
  elsif _type = 'account.updated' then
    _res := private.apply_account(_obj);
  elsif _type = 'charge.refunded' then
    if _account is null then
      _res := private.apply_cart_charge_refunded(_obj);
    else
      _res := private.apply_refund_v2(_obj, _account);
    end if;
  elsif _type in ('refund.created', 'refund.updated', 'refund.failed') and _account is null then
    _res := private.apply_cart_refund(_obj, _type);
  elsif _type = 'transfer.created' and _account is null then
    _res := private.apply_transfer(_obj);
  elsif _type = 'zexi.payout_failed' then
    _res := private.apply_payout_failed(_obj);
  else
    _res := jsonb_build_object('result', 'ignored');
  end if;

  update public.payment_events set result = _res ->> 'result' where event_id = _id;
  return _res || jsonb_build_object('duplicate', false);
end $$;
revoke execute on function public.stripe_ingest_event(text, text) from public;
grant execute on function public.stripe_ingest_event(text, text) to anon, authenticated;

revoke execute on function private.expire_open_checkouts(uuid[], text), private.apply_cart_session(jsonb, text),
  private.refund_part(public.payments, text), private.apply_cart_refund(jsonb, text),
  private.apply_cart_charge_refunded(jsonb), private.apply_transfer(jsonb), private.apply_payout_failed(jsonb),
  private.release_payout_on_delivery()
  from public, anon, authenticated;
