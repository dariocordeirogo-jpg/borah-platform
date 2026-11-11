-- Frete por tabela (região × peso), no formato PAC / SEDEX dos Correios.
-- Valores de referência, ajustáveis pela equipe em /admin/frete; troca pela API oficial quando houver contrato.
-- A taxa da LIVELANCE e a comissão de indicação passam a incidir só sobre os produtos (sem o frete).

alter table public.products add column weight_grams integer not null default 500 check (weight_grams between 1 and 30000);
alter table public.stores add column origin_cep text check (origin_cep ~ '^[0-9]{8}$');
grant update (weight_grams) on public.products to authenticated;
grant update (origin_cep) on public.stores to authenticated;

alter table public.orders add column shipping_service text check (shipping_service in ('pac', 'sedex'));
alter table public.orders add column shipping_days integer check (shipping_days between 1 and 60);

create table public.shipping_rates (
  service text not null check (service in ('pac', 'sedex')),
  zone text not null check (zone in ('local', 'estadual', 'regional', 'nacional')),
  max_grams integer not null check (max_grams between 1 and 30000),
  price_cents integer not null check (price_cents between 100 and 10000000),
  days integer not null check (days between 1 and 60),
  updated_at timestamptz not null default now(),
  primary key (service, zone, max_grams)
);
alter table public.shipping_rates enable row level security;
create policy "frete: tabela pública" on public.shipping_rates for select to anon, authenticated using (true);

-- Tabela inicial (R$, referência; revisar antes do lançamento)
insert into public.shipping_rates (service, zone, max_grams, price_cents, days)
select s.service, z.zone, w.max_grams,
       (round(w.base * z.mult * s.mult / 10) * 10)::integer,
       case s.service when 'pac' then z.pac_days else z.sedex_days end
from (values ('pac', 1.0), ('sedex', 1.6)) as s(service, mult)
cross join (values ('local', 1.0, 4, 1), ('estadual', 1.15, 6, 2), ('regional', 1.4, 8, 3), ('nacional', 1.8, 12, 5))
  as z(zone, mult, pac_days, sedex_days)
cross join (values (300, 1990), (1000, 2290), (2000, 2690), (5000, 3490), (10000, 4990), (20000, 7990), (30000, 10990))
  as w(max_grams, base);

-- CEP → UF (faixas oficiais dos Correios)
create function private.cep_uf(_cep text) returns text
language sql immutable set search_path = '' as $$
  select case
    when _cep !~ '^[0-9]{8}$' then null
    when n between 1000 and 19999 then 'SP'
    when n between 20000 and 28999 then 'RJ'
    when n between 29000 and 29999 then 'ES'
    when n between 30000 and 39999 then 'MG'
    when n between 40000 and 48999 then 'BA'
    when n between 49000 and 49999 then 'SE'
    when n between 50000 and 56999 then 'PE'
    when n between 57000 and 57999 then 'AL'
    when n between 58000 and 58999 then 'PB'
    when n between 59000 and 59999 then 'RN'
    when n between 60000 and 63999 then 'CE'
    when n between 64000 and 64999 then 'PI'
    when n between 65000 and 65999 then 'MA'
    when n between 66000 and 68899 then 'PA'
    when n between 68900 and 68999 then 'AP'
    when n between 69000 and 69299 or n between 69400 and 69899 then 'AM'
    when n between 69300 and 69399 then 'RR'
    when n between 69900 and 69999 then 'AC'
    when n between 70000 and 72799 or n between 73000 and 73699 then 'DF'
    when n between 72800 and 72999 or n between 73700 and 76799 then 'GO'
    when n between 76800 and 76999 then 'RO'
    when n between 77000 and 77999 then 'TO'
    when n between 78000 and 78899 then 'MT'
    when n between 79000 and 79999 then 'MS'
    when n between 80000 and 87999 then 'PR'
    when n between 88000 and 89999 then 'SC'
    when n between 90000 and 99999 then 'RS'
  end
  from (select case when _cep ~ '^[0-9]{8}$' then substr(_cep, 1, 5)::integer end as n) t
$$;

create function private.uf_region(_uf text) returns text
language sql immutable set search_path = '' as $$
  select case
    when _uf in ('AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO') then 'N'
    when _uf in ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE') then 'NE'
    when _uf in ('DF', 'GO', 'MS', 'MT') then 'CO'
    when _uf in ('ES', 'MG', 'RJ', 'SP') then 'SE'
    when _uf in ('PR', 'RS', 'SC') then 'S'
  end
$$;

-- Zona: local (mesmos 3 primeiros dígitos do CEP), estadual, regional ou nacional
create function private.shipping_zone(_from text, _to text) returns text
language sql immutable set search_path = '' as $$
  select case
    when private.cep_uf(_from) is null or private.cep_uf(_to) is null then null
    when substr(_from, 1, 3) = substr(_to, 1, 3) then 'local'
    when private.cep_uf(_from) = private.cep_uf(_to) then 'estadual'
    when private.uf_region(private.cep_uf(_from)) = private.uf_region(private.cep_uf(_to)) then 'regional'
    else 'nacional'
  end
$$;

-- Cotação de um envio: preço e prazo; null quando a loja ainda não informou o CEP de origem (frete a combinar)
create function private.quote_shipping(_store_id uuid, _dest_cep text, _grams integer, _service text,
  out price_cents integer, out days integer)
language plpgsql stable security definer set search_path = '' as $$
declare _origin text; _zone text;
begin
  select origin_cep into _origin from public.stores where id = _store_id;
  if _origin is null then return; end if;
  _zone := private.shipping_zone(_origin, _dest_cep);
  if _zone is null then raise exception 'shipping_cep_invalid' using errcode = 'P0001'; end if;
  if _grams > 30000 then raise exception 'shipping_too_heavy' using errcode = 'P0001'; end if;
  select r.price_cents, r.days into price_cents, days from public.shipping_rates r
  where r.service = _service and r.zone = _zone and r.max_grams >= greatest(_grams, 1)
  order by r.max_grams limit 1;
  if price_cents is null then raise exception 'shipping_unavailable' using errcode = 'P0001'; end if;
end $$;

-- Checkout: opções de frete por loja do carrinho para um endereço
create function public.quote_cart_shipping(_address_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare _uid uuid := auth.uid(); _cep text; _res jsonb := '[]'; _s record; _pac record; _sedex record;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select cep into _cep from public.addresses where id = _address_id and user_id = _uid;
  if _cep is null then raise exception 'address_not_found' using errcode = 'P0001'; end if;
  for _s in
    select p.store_id, st.name, st.origin_cep is not null as has_origin, sum(p.weight_grams * c.quantity)::integer as grams
    from public.cart_items c join public.products p on p.id = c.product_id join public.stores st on st.id = p.store_id
    where c.user_id = _uid group by p.store_id, st.name, st.origin_cep order by st.name
  loop
    select * into _pac from private.quote_shipping(_s.store_id, _cep, _s.grams, 'pac');
    select * into _sedex from private.quote_shipping(_s.store_id, _cep, _s.grams, 'sedex');
    _res := _res || jsonb_build_object('store_id', _s.store_id, 'store_name', _s.name, 'grams', _s.grams,
      'pac', case when _pac.price_cents is null then null else jsonb_build_object('price_cents', _pac.price_cents, 'days', _pac.days) end,
      'sedex', case when _sedex.price_cents is null then null else jsonb_build_object('price_cents', _sedex.price_cents, 'days', _sedex.days) end);
  end loop;
  return _res;
end $$;

-- Checkout completo: pedidos → frete → cupom → comissão de indicação (sobre os produtos, sem o frete)
drop function public.place_order(uuid, text, text);
create function public.place_order(_address_id uuid, _ref_code text default null, _coupon_code text default null,
  _shipping_service text default 'pac')
returns uuid[] language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _orders uuid[];
  _aff uuid;
  _rate integer;
  _o record;
  _q record;
  _cep text;
begin
  if _shipping_service not in ('pac', 'sedex') then raise exception 'shipping_service_invalid' using errcode = 'P0001'; end if;
  select cep into _cep from public.addresses where id = _address_id and user_id = _uid;
  _orders := public.checkout(_address_id);

  for _o in
    select o.id, o.store_id, sum(p.weight_grams * i.quantity)::integer as grams
    from public.orders o join public.order_items i on i.order_id = o.id join public.products p on p.id = i.product_id
    where o.id = any (_orders) group by o.id, o.store_id
  loop
    select * into _q from private.quote_shipping(_o.store_id, _cep, _o.grams, _shipping_service);
    if _q.price_cents is not null then
      update public.orders set shipping_cents = _q.price_cents, shipping_service = _shipping_service, shipping_days = _q.days,
        total_cents = subtotal_cents + _q.price_cents - discount_cents
      where id = _o.id;
    end if;
  end loop;

  if nullif(btrim(coalesce(_coupon_code, '')), '') is not null then
    perform private.apply_coupon(_orders, _coupon_code, _uid);
  end if;
  if _ref_code is null or lower(_ref_code) !~ '^[a-z0-9]{4,24}$' then return _orders; end if;
  select user_id into _aff from public.affiliates where code = lower(_ref_code) and is_active;
  if _aff is null or _aff = _uid then return _orders; end if;
  select rate_bps into _rate from private.affiliate_settings where id;
  insert into public.affiliate_commissions (order_id, order_number, affiliate_id, base_cents, rate_bps, amount_cents)
  select o.id, o.number, _aff, o.total_cents - o.shipping_cents, _rate,
         (round((o.total_cents - o.shipping_cents)::numeric * _rate / 10000))::integer
  from public.orders o join public.stores s on s.id = o.store_id
  where o.id = any (_orders) and s.owner_id <> _aff;
  return _orders;
end $$;

create or replace function public.checkout_with_ref(_address_id uuid, _ref_code text default null)
returns uuid[] language sql security definer set search_path = '' as $$
  select public.place_order(_address_id, _ref_code, null, 'pac')
$$;

-- Pagamento: taxa da LIVELANCE só sobre os produtos (o frete vai inteiro para a loja)
create or replace function public.start_order_payment(_order_id uuid) returns jsonb
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
  values (_order_id, _uid, _o.store_id, _acct.account_id, _o.total_cents, private.fee_for(_o.total_cents - _o.shipping_cents),
          now() + make_interval(mins => _minutes))
  returning * into _p;
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (_uid, 'payment.start', 'payment', _p.id::text);
  return jsonb_build_object('payment_id', _p.id, 'session_id', null,
    'amount_cents', _p.amount_cents, 'fee_cents', _p.fee_cents, 'destination', _p.destination_account,
    'order_number', _o.number, 'store_name', _o.store_name);
end $$;

-- Equipe (operações) ajusta a tabela
create function public.admin_set_shipping_rate(_service text, _zone text, _max_grams integer, _price_cents integer, _days integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.staff_can('stores') then raise exception 'forbidden' using errcode = '42501'; end if;
  if _price_cents not between 100 and 10000000 or _days not between 1 and 60 then
    raise exception 'invalid_rate' using errcode = 'P0001';
  end if;
  update public.shipping_rates set price_cents = _price_cents, days = _days, updated_at = now()
  where service = _service and zone = _zone and max_grams = _max_grams;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, data)
  values (auth.uid(), 'admin.shipping_rate.update', 'shipping_rate', _service || ':' || _zone || ':' || _max_grams,
          jsonb_build_object('price_cents', _price_cents, 'days', _days));
end $$;

revoke execute on function private.cep_uf(text), private.uf_region(text), private.shipping_zone(text, text),
  private.quote_shipping(uuid, text, integer, text) from public, anon, authenticated;
revoke execute on function public.quote_cart_shipping(uuid), public.admin_set_shipping_rate(text, text, integer, integer, integer),
  public.place_order(uuid, text, text, text) from public, anon;
grant execute on function public.quote_cart_shipping(uuid), public.admin_set_shipping_rate(text, text, integer, integer, integer),
  public.place_order(uuid, text, text, text) to authenticated;
