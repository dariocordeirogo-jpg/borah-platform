-- Ofertas e ofertas relâmpago
-- 1) Desconto de cada produto calculado pelo banco (preço "de" × preço "por"), para a página de ofertas.
-- 2) Oferta relâmpago: a loja agenda um preço promocional por 1 a 24 horas. No início o banco troca o preço do
--    produto (o preço antigo vira o "de"); no fim, devolve o preço normal. O pedido continua usando o preço do produto,
--    então quem decide o valor é sempre o banco.

alter table public.products
  add column discount_pct smallint generated always as (
    case when compare_at_cents is not null and compare_at_cents > price_cents
      then (100 - (price_cents * 100) / compare_at_cents)::smallint end
  ) stored;
create index products_discount_idx on public.products (discount_pct desc) where discount_pct is not null and status = 'active';

create table public.flash_deals (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  deal_price_cents integer not null check (deal_price_cents > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'ended', 'cancelled')),
  -- Preço e "de" do produto antes da oferta (para devolver no fim)
  original_price_cents integer,
  original_compare_cents integer,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours')
);
create index flash_deals_active_idx on public.flash_deals (ends_at) where status = 'active';
create index flash_deals_scheduled_idx on public.flash_deals (starts_at) where status = 'scheduled';
create index flash_deals_store_idx on public.flash_deals (store_id, created_at desc);
create unique index flash_deals_one_open_per_product on public.flash_deals (product_id) where status in ('scheduled', 'active');
alter table public.flash_deals enable row level security;
create policy "ofertas relâmpago: público vê as ativas e agendadas" on public.flash_deals for select to anon, authenticated
  using (status in ('scheduled', 'active'));
create policy "ofertas relâmpago: loja vê as suas" on public.flash_deals for select to authenticated
  using (store_id = (select private.my_store_id()));
revoke insert, update, delete on public.flash_deals from anon, authenticated;

-- Liga uma oferta: troca o preço do produto (o preço atual vira o "de")
create function private.start_flash_deal(_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare _d public.flash_deals; _p public.products;
begin
  select * into _d from public.flash_deals where id = _id and status = 'scheduled' for update;
  if _d.id is null then return; end if;
  select * into _p from public.products where id = _d.product_id for update;
  if _p.id is null or _p.status <> 'active' or _p.price_cents <= _d.deal_price_cents then
    update public.flash_deals set status = 'cancelled' where id = _id;
    return;
  end if;
  update public.flash_deals set status = 'active', original_price_cents = _p.price_cents, original_compare_cents = _p.compare_at_cents
  where id = _id;
  update public.products set price_cents = _d.deal_price_cents, compare_at_cents = _p.price_cents where id = _p.id;
end $$;

-- Desliga uma oferta: devolve o preço normal (se a loja mudou o preço no meio, mantém o que ela escolheu)
create function private.end_flash_deal(_id bigint, _status text) returns void
language plpgsql security definer set search_path = '' as $$
declare _d public.flash_deals; _p public.products;
begin
  select * into _d from public.flash_deals where id = _id and status in ('scheduled', 'active') for update;
  if _d.id is null then return; end if;
  if _d.status = 'active' then
    select * into _p from public.products where id = _d.product_id for update;
    if _p.id is not null then
      if _p.price_cents = _d.deal_price_cents then
        update public.products set price_cents = _d.original_price_cents,
          compare_at_cents = case when _d.original_compare_cents > _d.original_price_cents then _d.original_compare_cents end
        where id = _p.id;
      elsif _p.compare_at_cents = _d.original_price_cents then
        update public.products set compare_at_cents = case when _d.original_compare_cents > _p.price_cents then _d.original_compare_cents end
        where id = _p.id;
      end if;
    end if;
  end if;
  update public.flash_deals set status = _status where id = _id;
end $$;

-- Roda a cada minuto: liga as que começaram e desliga as que terminaram
create function private.run_flash_deals() returns void
language plpgsql security definer set search_path = '' as $$
declare _id bigint;
begin
  for _id in select id from public.flash_deals where status = 'active' and ends_at <= now() loop
    perform private.end_flash_deal(_id, 'ended');
  end loop;
  for _id in select id from public.flash_deals where status = 'scheduled' and ends_at <= now() loop
    update public.flash_deals set status = 'cancelled' where id = _id;
  end loop;
  for _id in select id from public.flash_deals where status = 'scheduled' and starts_at <= now() order by starts_at loop
    perform private.start_flash_deal(_id);
  end loop;
end $$;

-- Loja agenda uma oferta relâmpago (1 a 24 horas, começando em até 7 dias, pelo menos 5% de desconto)
create function public.create_flash_deal(_product_id uuid, _deal_price_cents integer, _starts_at timestamptz, _hours integer)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  _store uuid := private.my_store_id();
  _p public.products;
  _start timestamptz := greatest(coalesce(_starts_at, now()), now());
  _id bigint;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into _p from public.products where id = _product_id;
  if _p.id is null or _store is null or _p.store_id <> _store then raise exception 'product_not_found' using errcode = 'P0001'; end if;
  if _p.status <> 'active' then raise exception 'product_not_active' using errcode = 'P0001'; end if;
  if _hours is null or _hours not between 1 and 24 then raise exception 'invalid_duration' using errcode = 'P0001'; end if;
  if _start > now() + interval '7 days' then raise exception 'invalid_start' using errcode = 'P0001'; end if;
  if _deal_price_cents is null or _deal_price_cents <= 0 or _deal_price_cents > (_p.price_cents * 95) / 100 then
    raise exception 'invalid_deal_price' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.flash_deals where product_id = _p.id and status in ('scheduled', 'active')) then
    raise exception 'deal_exists' using errcode = 'P0001';
  end if;
  insert into public.flash_deals (product_id, store_id, deal_price_cents, starts_at, ends_at)
  values (_p.id, _store, _deal_price_cents, _start, _start + make_interval(hours => _hours))
  returning id into _id;
  insert into public.audit_logs (actor_id, action, entity, entity_id, data)
  values (auth.uid(), 'flash_deal.create', 'product', _p.id::text, jsonb_build_object('deal_id', _id, 'price_cents', _deal_price_cents));
  -- Começa agora? Liga na hora (sem esperar o minuto do agendador)
  if _start <= now() then perform private.start_flash_deal(_id); end if;
  return _id;
end $$;

-- Loja encerra a oferta antes da hora (o preço normal volta na hora)
create function public.cancel_flash_deal(_deal_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.flash_deals where id = _deal_id and store_id = private.my_store_id() and status in ('scheduled', 'active')) then
    raise exception 'deal_not_found' using errcode = 'P0001';
  end if;
  perform private.end_flash_deal(_deal_id, 'cancelled');
end $$;

revoke execute on function public.create_flash_deal(uuid, integer, timestamptz, integer), public.cancel_flash_deal(bigint) from public, anon;
grant execute on function public.create_flash_deal(uuid, integer, timestamptz, integer), public.cancel_flash_deal(bigint) to authenticated;
revoke execute on function private.start_flash_deal(bigint), private.end_flash_deal(bigint, text), private.run_flash_deals() from public, anon, authenticated;

select cron.schedule('zexi-flash-deals', '* * * * *', 'select private.run_flash_deals()');
