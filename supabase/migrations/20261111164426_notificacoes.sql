-- Notificações: e-mails de pedido (Resend) e código de confirmação do celular por SMS (Zenvia).
-- O banco decide O QUE avisar (fila private.outbox, preenchida por gatilhos e funções); o servidor só entrega.
-- A entrega usa as funções outbox_claim / outbox_report, protegidas por um segredo guardado no Vault (outbox_secret).

create table private.outbox (
  id bigint generated always as identity primary key,
  channel text not null check (channel in ('email', 'sms')),
  kind text not null,
  recipient text not null,
  payload jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  locked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index outbox_pending_idx on private.outbox (channel, created_at) where status in ('pending', 'sending');
alter table private.outbox enable row level security;

create function private.enqueue(_channel text, _kind text, _recipient text, _payload jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into private.outbox (channel, kind, recipient, payload)
  select _channel, _kind, _recipient, _payload where nullif(btrim(coalesce(_recipient, '')), '') is not null
$$;

-- Pedidos → e-mails para quem comprou e para a loja
create function private.order_notifications() returns trigger
language plpgsql security definer set search_path = '' as $$
declare _buyer text; _seller text; _p jsonb := jsonb_build_object('order_id', new.id);
begin
  select email into _buyer from auth.users where id = new.buyer_id;
  select u.email into _seller from public.stores s join auth.users u on u.id = s.owner_id where s.id = new.store_id;
  if tg_op = 'INSERT' then
    perform private.enqueue('email', 'order.created', _buyer, _p);
    perform private.enqueue('email', 'order.received', _seller, _p);
  elsif new.status is distinct from old.status then
    if new.status = 'paid' then
      perform private.enqueue('email', 'order.paid', _buyer, _p);
      perform private.enqueue('email', 'order.paid.seller', _seller, _p);
    elsif new.status = 'cancelled' then
      perform private.enqueue('email', 'order.cancelled', _buyer, _p);
      perform private.enqueue('email', 'order.cancelled.seller', _seller, _p);
    end if;
  end if;
  return new;
end $$;
create trigger orders_notify_insert after insert on public.orders for each row execute function private.order_notifications();
create trigger orders_notify_status after update of status on public.orders for each row execute function private.order_notifications();

-- Código do celular (SMS): guarda só o hash; 10 minutos, 5 tentativas, 1 envio por minuto e 5 por dia
create table private.phone_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  last_sent_at timestamptz not null default now(),
  day date not null default (now() at time zone 'America/Sao_Paulo')::date,
  sent_today integer not null default 1
);
alter table private.phone_codes enable row level security;

create function private.phone_code_hash(_uid uuid, _code text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(_uid::text || ':' || _code, 'sha256'), 'hex')
$$;

create function public.request_phone_code() returns void
language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _v public.user_verifications;
  _c private.phone_codes;
  _today date := (now() at time zone 'America/Sao_Paulo')::date;
  _code text := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into _v from public.user_verifications where user_id = _uid;
  if _v.user_id is null then raise exception 'verification_required' using errcode = 'P0001'; end if;
  if _v.phone_verified_at is not null then raise exception 'phone_already_verified' using errcode = 'P0001'; end if;
  select * into _c from private.phone_codes where user_id = _uid for update;
  if _c.user_id is not null then
    if _c.last_sent_at > now() - interval '60 seconds' then raise exception 'sms_too_soon' using errcode = 'P0001'; end if;
    if _c.day = _today and _c.sent_today >= 5 then raise exception 'sms_daily_limit' using errcode = 'P0001'; end if;
  end if;
  insert into private.phone_codes (user_id, phone, code_hash, expires_at)
  values (_uid, _v.phone, private.phone_code_hash(_uid, _code), now() + interval '10 minutes')
  on conflict (user_id) do update set phone = excluded.phone, code_hash = excluded.code_hash,
    expires_at = excluded.expires_at, attempts = 0, last_sent_at = now(),
    sent_today = case when private.phone_codes.day = _today then private.phone_codes.sent_today + 1 else 1 end,
    day = _today;
  perform private.enqueue('sms', 'phone.code', _v.phone, jsonb_build_object('code', _code));
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (_uid, 'verification.sms_requested', 'user', _uid::text);
end $$;

create function public.confirm_phone_code(_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare _uid uuid := auth.uid(); _c private.phone_codes;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into _c from private.phone_codes where user_id = _uid for update;
  if _c.user_id is null or _c.expires_at <= now() then raise exception 'sms_code_expired' using errcode = 'P0001'; end if;
  if _c.attempts >= 5 then raise exception 'sms_too_many_attempts' using errcode = 'P0001'; end if;
  if coalesce(_code, '') !~ '^[0-9]{6}$' or private.phone_code_hash(_uid, _code) <> _c.code_hash then
    update private.phone_codes set attempts = attempts + 1 where user_id = _uid;
    raise exception 'sms_code_wrong' using errcode = 'P0001';
  end if;
  update public.user_verifications set phone_verified_at = now() where user_id = _uid and phone = _c.phone;
  if not found then raise exception 'sms_code_expired' using errcode = 'P0001'; end if;
  delete from private.phone_codes where user_id = _uid;
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (_uid, 'verification.phone_confirmed', 'user', _uid::text);
end $$;

-- Entrega (servidor): segredo do Vault; só canais configurados
create function private.outbox_secret_ok(_secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(length(_secret) >= 32 and _secret = (select decrypted_secret from vault.decrypted_secrets where name = 'outbox_secret' limit 1), false)
$$;

-- Dados do pedido para montar o e-mail na hora do envio (valores já com frete e cupom)
create function private.order_mail_data(_order_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('order_id', o.id, 'number', o.number, 'status', o.status,
    'subtotal_cents', o.subtotal_cents, 'shipping_cents', o.shipping_cents, 'shipping_service', o.shipping_service,
    'discount_cents', o.discount_cents, 'total_cents', o.total_cents, 'cancelled_reason', o.cancelled_reason,
    'store_name', s.name,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('title', i.title, 'quantity', i.quantity) order by i.title), '[]')
              from public.order_items i where i.order_id = o.id))
  from public.orders o join public.stores s on s.id = o.store_id where o.id = _order_id
$$;

create function public.outbox_claim(_secret text, _channels text[], _limit integer default 20)
returns table (id bigint, channel text, kind text, recipient text, data jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.outbox_secret_ok(_secret) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  with picked as (
    select o.id from private.outbox o
    where o.channel = any (_channels)
      and (o.status = 'pending' or (o.status = 'sending' and o.locked_at < now() - interval '10 minutes'))
    order by o.created_at
    limit least(greatest(coalesce(_limit, 20), 1), 100)
    for update skip locked
  ), upd as (
    update private.outbox o set status = 'sending', attempts = o.attempts + 1, locked_at = now()
    from picked where o.id = picked.id
    returning o.id, o.channel, o.kind, o.recipient, o.payload
  )
  select u.id, u.channel, u.kind, u.recipient,
         case when u.payload ? 'order_id' then coalesce(private.order_mail_data((u.payload->>'order_id')::uuid), u.payload)
              else u.payload end
  from upd u;
end $$;

create function public.outbox_report(_secret text, _id bigint, _ok boolean, _error text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.outbox_secret_ok(_secret) then raise exception 'forbidden' using errcode = '42501'; end if;
  update private.outbox set
    status = case when _ok then 'sent' when attempts >= 5 then 'failed' else 'pending' end,
    sent_at = case when _ok then now() end,
    last_error = case when _ok then null else left(_error, 300) end,
    -- código de SMS não fica guardado depois de entregue (nem depois de desistir)
    payload = case when channel = 'sms' and (_ok or attempts >= 5) then null else payload end,
    locked_at = null
  where id = _id and status = 'sending';
end $$;

-- Equipe: situação da fila (sem conteúdo das mensagens)
create function public.admin_outbox_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('view') then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select coalesce(jsonb_object_agg(channel || ':' || status, n), '{}')
          from (select channel, status, count(*) n from private.outbox group by channel, status) t);
end $$;

revoke execute on function private.enqueue(text, text, text, jsonb), private.order_notifications(),
  private.phone_code_hash(uuid, text), private.outbox_secret_ok(text), private.order_mail_data(uuid)
  from public, anon, authenticated;
revoke execute on function public.request_phone_code(), public.confirm_phone_code(text), public.admin_outbox_stats() from public, anon;
grant execute on function public.request_phone_code(), public.confirm_phone_code(text), public.admin_outbox_stats() to authenticated;
-- O servidor chama sem sessão de usuário; a proteção é o segredo
revoke execute on function public.outbox_claim(text, text[], integer), public.outbox_report(text, bigint, boolean, text) from public;
grant execute on function public.outbox_claim(text, text[], integer), public.outbox_report(text, bigint, boolean, text) to anon, authenticated;
