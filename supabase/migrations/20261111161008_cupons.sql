-- Cupons de desconto da LOJA: a loja cria e banca o desconto. A comissão da LIVELANCE e a de indicação
-- são calculadas sobre o total já com desconto (pagamento e comissão usam orders.total_cents).

create type public.coupon_kind as enum ('percent', 'fixed');

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{3,20}$'),
  kind public.coupon_kind not null,
  percent_off integer check (percent_off between 1 and 90),
  amount_off_cents integer check (amount_off_cents between 100 and 10000000),
  min_subtotal_cents integer not null default 0 check (min_subtotal_cents between 0 and 100000000),
  max_uses integer check (max_uses between 1 and 1000000),
  uses_count integer not null default 0 check (uses_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'percent' and percent_off is not null and amount_off_cents is null)
      or (kind = 'fixed' and amount_off_cents is not null and percent_off is null)),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index coupons_store_idx on public.coupons (store_id, created_at desc);

-- Uso do cupom: um por comprador; volta a valer se o pedido for cancelado
create table public.coupon_redemptions (
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  discount_cents integer not null check (discount_cents > 0),
  created_at timestamptz not null default now(),
  primary key (coupon_id, user_id)
);
create index coupon_redemptions_user_idx on public.coupon_redemptions (user_id);

-- Pedido: desconto entra no total
alter table public.orders add column discount_cents integer not null default 0 check (discount_cents >= 0);
alter table public.orders add column coupon_code text;
alter table public.orders drop constraint orders_check;
alter table public.orders add constraint orders_total_check
  check (total_cents = subtotal_cents + shipping_cents - discount_cents and discount_cents <= subtotal_cents);

create trigger coupons_set_updated_at before update on public.coupons for each row execute function private.set_updated_at();

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

-- Loja lê os próprios cupons; equipe lê todos. Comprador não lista cupons (consulta pelo código via check_coupon).
create policy "cupons: loja dona lê" on public.coupons for select to authenticated
  using (store_id = (select private.my_store_id()) or (select private.staff_can('view')));
create policy "usos: comprador ou loja dona leem" on public.coupon_redemptions for select to authenticated
  using (user_id = (select auth.uid())
    or exists (select 1 from public.coupons c where c.id = coupon_id and c.store_id = (select private.my_store_id()))
    or (select private.staff_can('view')));

create function private.normalize_coupon(_code text) returns text
language sql immutable set search_path = '' as $$ select upper(btrim(coalesce(_code, ''))) $$;

-- Desconto de um cupom sobre um subtotal (sempre sobra pelo menos R$ 1,00 a pagar)
create function private.coupon_discount(_c public.coupons, _subtotal integer, _shipping integer) returns integer
language sql immutable set search_path = '' as $$
  select greatest(0, least(
    case when _c.kind = 'percent' then floor(_subtotal::numeric * _c.percent_off / 100)::integer else _c.amount_off_cents end,
    _subtotal,
    _subtotal + _shipping - 100))
$$;

-- Loja cria cupom
create function public.create_coupon(_code text, _kind public.coupon_kind, _value integer, _min_subtotal_cents integer default 0,
  _max_uses integer default null, _starts_at timestamptz default null, _ends_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare _store uuid := private.my_store_id(); _c text := private.normalize_coupon(_code); _id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if _store is null then raise exception 'store_required' using errcode = 'P0001'; end if;
  if _c !~ '^[A-Z0-9]{3,20}$' then raise exception 'coupon_code_invalid' using errcode = 'P0001'; end if;
  if _kind = 'percent' and (_value is null or _value not between 1 and 90) then raise exception 'coupon_value_invalid' using errcode = 'P0001'; end if;
  if _kind = 'fixed' and (_value is null or _value not between 100 and 10000000) then raise exception 'coupon_value_invalid' using errcode = 'P0001'; end if;
  if _ends_at is not null and _ends_at <= coalesce(_starts_at, now()) then raise exception 'coupon_dates_invalid' using errcode = 'P0001'; end if;
  if exists (select 1 from public.coupons where code = _c) then raise exception 'coupon_code_taken' using errcode = 'P0001'; end if;
  insert into public.coupons (store_id, code, kind, percent_off, amount_off_cents, min_subtotal_cents, max_uses, starts_at, ends_at)
  values (_store, _c, _kind, case when _kind = 'percent' then _value end, case when _kind = 'fixed' then _value end,
          greatest(coalesce(_min_subtotal_cents, 0), 0), _max_uses, _starts_at, _ends_at)
  returning id into _id;
  insert into public.audit_logs (actor_id, action, entity, entity_id, data)
  values (auth.uid(), 'coupon.create', 'coupon', _id::text, jsonb_build_object('code', _c, 'kind', _kind, 'value', _value));
  return _id;
end $$;

-- Loja liga/desliga cupom
create function public.set_coupon_active(_coupon_id uuid, _active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.coupons set is_active = _active where id = _coupon_id and store_id = private.my_store_id();
  if not found then raise exception 'coupon_not_found' using errcode = 'P0001'; end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, data)
  values (auth.uid(), case when _active then 'coupon.activate' else 'coupon.deactivate' end, 'coupon', _coupon_id::text, '{}');
end $$;

-- Valida o cupom para o comprador atual (sem gravar nada). Erros: coupon_invalid, coupon_expired, coupon_exhausted, coupon_used.
create function private.usable_coupon(_code text, _uid uuid, _lock boolean) returns public.coupons
language plpgsql security definer set search_path = '' as $$
declare _c public.coupons; _n text := private.normalize_coupon(_code);
begin
  if _n !~ '^[A-Z0-9]{3,20}$' then raise exception 'coupon_invalid' using errcode = 'P0001'; end if;
  if _lock then
    select * into _c from public.coupons where code = _n for update;
  else
    select * into _c from public.coupons where code = _n;
  end if;
  if _c.id is null or not _c.is_active
     or not exists (select 1 from public.stores s where s.id = _c.store_id and s.is_active) then
    raise exception 'coupon_invalid' using errcode = 'P0001';
  end if;
  if (_c.starts_at is not null and now() < _c.starts_at) or (_c.ends_at is not null and now() >= _c.ends_at) then
    raise exception 'coupon_expired' using errcode = 'P0001';
  end if;
  if _c.max_uses is not null and _c.uses_count >= _c.max_uses then raise exception 'coupon_exhausted' using errcode = 'P0001'; end if;
  if exists (select 1 from public.coupon_redemptions where coupon_id = _c.id and user_id = _uid) then
    raise exception 'coupon_used' using errcode = 'P0001';
  end if;
  return _c;
end $$;

-- Prévia no carrinho: de qual loja é o cupom e quanto desconta hoje (o valor final é decidido no pedido)
create function public.check_coupon(_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare _uid uuid := auth.uid(); _c public.coupons; _sub integer;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  _c := private.usable_coupon(_code, _uid, false);
  select coalesce(sum(p.price_cents * ci.quantity), 0)::integer into _sub
  from public.cart_items ci join public.products p on p.id = ci.product_id
  where ci.user_id = _uid and p.store_id = _c.store_id;
  if _sub = 0 then raise exception 'coupon_not_applicable' using errcode = 'P0001'; end if;
  if _sub < _c.min_subtotal_cents then
    raise exception 'coupon_min_subtotal:%', _c.min_subtotal_cents using errcode = 'P0001';
  end if;
  return jsonb_build_object('code', _c.code, 'store_id', _c.store_id,
    'store_name', (select name from public.stores where id = _c.store_id),
    'discount_cents', private.coupon_discount(_c, _sub, 0));
end $$;

-- Aplica o cupom no pedido da loja dona do cupom (dentro do checkout; erro desfaz o checkout inteiro)
create function private.apply_coupon(_orders uuid[], _code text, _uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare _c public.coupons; _o public.orders; _d integer;
begin
  _c := private.usable_coupon(_code, _uid, true);
  select * into _o from public.orders where id = any (_orders) and store_id = _c.store_id for update;
  if _o.id is null then raise exception 'coupon_not_applicable' using errcode = 'P0001'; end if;
  if _o.subtotal_cents < _c.min_subtotal_cents then
    raise exception 'coupon_min_subtotal:%', _c.min_subtotal_cents using errcode = 'P0001';
  end if;
  _d := private.coupon_discount(_c, _o.subtotal_cents, _o.shipping_cents);
  if _d <= 0 then raise exception 'coupon_not_applicable' using errcode = 'P0001'; end if;
  update public.orders set discount_cents = _d, coupon_code = _c.code,
    total_cents = subtotal_cents + shipping_cents - _d
  where id = _o.id;
  insert into public.coupon_redemptions (coupon_id, user_id, order_id, discount_cents) values (_c.id, _uid, _o.id, _d);
  update public.coupons set uses_count = uses_count + 1 where id = _c.id;
  insert into public.audit_logs (actor_id, action, entity, entity_id, data)
  values (_uid, 'coupon.redeem', 'order', _o.id::text, jsonb_build_object('code', _c.code, 'discount_cents', _d));
end $$;

-- Checkout completo: pedidos → cupom → comissão de indicação (sobre o total já com desconto)
create function public.place_order(_address_id uuid, _ref_code text default null, _coupon_code text default null)
returns uuid[] language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _orders uuid[];
  _aff uuid;
  _rate integer;
begin
  _orders := public.checkout(_address_id);
  if nullif(btrim(coalesce(_coupon_code, '')), '') is not null then
    perform private.apply_coupon(_orders, _coupon_code, _uid);
  end if;
  if _ref_code is null or lower(_ref_code) !~ '^[a-z0-9]{4,24}$' then return _orders; end if;
  select user_id into _aff from public.affiliates where code = lower(_ref_code) and is_active;
  if _aff is null or _aff = _uid then return _orders; end if;
  select rate_bps into _rate from private.affiliate_settings where id;
  insert into public.affiliate_commissions (order_id, order_number, affiliate_id, base_cents, rate_bps, amount_cents)
  select o.id, o.number, _aff, o.total_cents, _rate, (round(o.total_cents::numeric * _rate / 10000))::integer
  from public.orders o join public.stores s on s.id = o.store_id
  where o.id = any (_orders) and s.owner_id <> _aff;
  return _orders;
end $$;

-- Mantém a função antiga (mesmo comportamento, sem cupom)
create or replace function public.checkout_with_ref(_address_id uuid, _ref_code text default null)
returns uuid[] language sql security definer set search_path = '' as $$
  select public.place_order(_address_id, _ref_code, null)
$$;

-- Pedido cancelado devolve o cupom (o comprador pode usar de novo)
create function private.release_coupon() returns trigger
language plpgsql security definer set search_path = '' as $$
declare _coupon uuid;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    delete from public.coupon_redemptions where order_id = new.id returning coupon_id into _coupon;
    if _coupon is not null then
      update public.coupons set uses_count = greatest(uses_count - 1, 0) where id = _coupon;
    end if;
  end if;
  return new;
end $$;
create trigger orders_release_coupon after update of status on public.orders
  for each row execute function private.release_coupon();

revoke execute on function private.normalize_coupon(text), private.coupon_discount(public.coupons, integer, integer),
  private.usable_coupon(text, uuid, boolean), private.apply_coupon(uuid[], text, uuid), private.release_coupon()
  from public, anon, authenticated;
revoke execute on function public.create_coupon(text, public.coupon_kind, integer, integer, integer, timestamptz, timestamptz),
  public.set_coupon_active(uuid, boolean), public.check_coupon(text), public.place_order(uuid, text, text) from public, anon;
grant execute on function public.create_coupon(text, public.coupon_kind, integer, integer, integer, timestamptz, timestamptz),
  public.set_coupon_active(uuid, boolean), public.check_coupon(text), public.place_order(uuid, text, text) to authenticated;
