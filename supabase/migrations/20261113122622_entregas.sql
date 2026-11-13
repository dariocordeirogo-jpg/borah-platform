-- Entregas: a loja marca o pedido como enviado (transportadora + código de rastreio), o comprador acompanha a linha do
-- tempo e confirma o recebimento. Sem confirmação, o pedido vira entregue sozinho 21 dias depois do envio.
-- Tudo passa por funções do banco: ninguém altera status direto pela API.

alter table public.orders
  add column carrier text check (carrier is null or carrier in ('correios', 'jadlog', 'loggi', 'jt', 'total_express', 'azul_cargo', 'propria', 'outra')),
  add column tracking_code text check (tracking_code is null or tracking_code ~ '^[A-Z0-9-]{4,40}$'),
  add column shipped_at timestamptz,
  add column delivered_at timestamptz,
  add column delivery_confirmed_by text check (delivery_confirmed_by is null or delivery_confirmed_by in ('buyer', 'auto'));

-- Linha do tempo do pedido (escrita só pelo banco)
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null check (kind in ('created', 'paid', 'shipped', 'tracking_updated', 'delivered', 'cancelled')),
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, id);
alter table public.order_events enable row level security;
create policy "eventos do pedido: comprador ou loja lê" on public.order_events for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and (o.buyer_id = (select auth.uid()) or o.store_id = (select private.my_store_id()))
  ));
revoke insert, update, delete, truncate on public.order_events from anon, authenticated;

create function private.order_timeline() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, kind) values (new.id, 'created');
  elsif new.status is distinct from old.status and new.status in ('paid', 'shipped', 'delivered', 'cancelled') then
    insert into public.order_events (order_id, kind, detail) values (new.id, new.status::text,
      case
        when new.status = 'shipped' then jsonb_build_object('carrier', new.carrier, 'tracking_code', new.tracking_code)
        when new.status = 'delivered' then jsonb_build_object('by', new.delivery_confirmed_by)
        when new.status = 'cancelled' then jsonb_build_object('reason', new.cancelled_reason)
        else '{}'::jsonb
      end);
  elsif new.status = 'shipped' and new.tracking_code is distinct from old.tracking_code then
    insert into public.order_events (order_id, kind, detail)
    values (new.id, 'tracking_updated', jsonb_build_object('carrier', new.carrier, 'tracking_code', new.tracking_code));
  end if;
  return new;
end $$;
create trigger orders_timeline_insert after insert on public.orders for each row execute function private.order_timeline();
create trigger orders_timeline_update after update of status, tracking_code on public.orders for each row execute function private.order_timeline();

-- Pedidos já existentes ganham o início da linha do tempo
insert into public.order_events (order_id, kind, created_at) select id, 'created', created_at from public.orders;
insert into public.order_events (order_id, kind, created_at)
  select id, status::text, updated_at from public.orders where status in ('paid', 'cancelled');

-- Loja informa o envio (ou corrige o código enquanto o pedido está em trânsito)
create function public.ship_order(_order_id uuid, _carrier text, _tracking_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  _store uuid := private.my_store_id();
  _o public.orders;
  _code text := upper(regexp_replace(coalesce(_tracking_code, ''), '\s', '', 'g'));
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into _o from public.orders where id = _order_id for update;
  if _o.id is null or _store is null or _o.store_id <> _store then raise exception 'order_not_found' using errcode = 'P0001'; end if;
  if _carrier is null or _carrier not in ('correios', 'jadlog', 'loggi', 'jt', 'total_express', 'azul_cargo', 'propria', 'outra') then
    raise exception 'invalid_carrier' using errcode = 'P0001';
  end if;
  if _code !~ '^[A-Z0-9-]{4,40}$' then raise exception 'invalid_tracking_code' using errcode = 'P0001'; end if;
  if _o.status = 'paid' then
    update public.orders set status = 'shipped', carrier = _carrier, tracking_code = _code, shipped_at = now() where id = _o.id;
  elsif _o.status = 'shipped' then
    update public.orders set carrier = _carrier, tracking_code = _code where id = _o.id;
  else
    raise exception 'order_not_shippable' using errcode = 'P0001';
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, data)
  values (auth.uid(), 'order.ship', 'order', _o.id::text, jsonb_build_object('carrier', _carrier, 'tracking_code', _code));
end $$;
revoke execute on function public.ship_order(uuid, text, text) from public, anon;
grant execute on function public.ship_order(uuid, text, text) to authenticated;

-- Comprador confirma que recebeu
create function public.confirm_delivery(_order_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare _o public.orders;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into _o from public.orders where id = _order_id for update;
  if _o.id is null or _o.buyer_id <> auth.uid() then raise exception 'order_not_found' using errcode = 'P0001'; end if;
  if _o.status <> 'shipped' then raise exception 'order_not_in_transit' using errcode = 'P0001'; end if;
  update public.orders set status = 'delivered', delivered_at = now(), delivery_confirmed_by = 'buyer' where id = _o.id;
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (auth.uid(), 'order.delivered', 'order', _o.id::text);
end $$;
revoke execute on function public.confirm_delivery(uuid) from public, anon;
grant execute on function public.confirm_delivery(uuid) to authenticated;

-- Sem confirmação do comprador: entregue automaticamente 21 dias depois do envio
create function private.auto_deliver_orders() returns integer
language plpgsql security definer set search_path = '' as $$
declare _n integer;
begin
  update public.orders set status = 'delivered', delivered_at = now(), delivery_confirmed_by = 'auto'
  where status = 'shipped' and shipped_at < now() - interval '21 days';
  get diagnostics _n = row_count;
  return _n;
end $$;
revoke execute on function private.auto_deliver_orders() from public, anon, authenticated;
select cron.schedule('zexi-auto-deliver-orders', '17 6 * * *', 'select private.auto_deliver_orders()');

-- E-mails: pedido enviado (comprador) e entregue (loja)
create or replace function private.order_notifications() returns trigger
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
    elsif new.status = 'shipped' then
      perform private.enqueue('email', 'order.shipped', _buyer,
        _p || jsonb_build_object('carrier', new.carrier, 'tracking_code', new.tracking_code));
    elsif new.status = 'delivered' then
      perform private.enqueue('email', 'order.delivered.seller', _seller, _p);
    elsif new.status = 'cancelled' then
      perform private.enqueue('email', 'order.cancelled', _buyer, _p);
      perform private.enqueue('email', 'order.cancelled.seller', _seller, _p);
    end if;
  end if;
  return new;
end $$;
