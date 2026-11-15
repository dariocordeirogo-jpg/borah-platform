-- Avaliações de produto e reputação da loja (como nos grandes marketplaces).
-- Só quem recebeu o produto avalia (pedido entregue, até 60 dias depois da entrega; dá para editar nesse prazo).
-- A nota média de cada produto fica numa tabela própria, calculada pelo banco (a loja não consegue alterar).
-- A reputação da loja é calculada na hora a partir de vendas, entregas no prazo, respostas às perguntas e notas.

create table public.product_reviews (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  buyer_alias text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) between 3 and 1000),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, product_id)
);
create index product_reviews_product_idx on public.product_reviews (product_id, created_at desc) where not hidden;
create index product_reviews_store_idx on public.product_reviews (store_id) where not hidden;
create index product_reviews_buyer_idx on public.product_reviews (buyer_id);
alter table public.product_reviews enable row level security;
create policy "avaliações: visitante lê as visíveis" on public.product_reviews for select to anon using (not hidden);
create policy "avaliações: leitura de quem entrou" on public.product_reviews for select to authenticated using (
  not hidden or buyer_id = (select auth.uid()) or (select private.staff_can('moderate'))
);
revoke insert, update, delete on public.product_reviews from anon, authenticated;

-- Média e total por produto (só o banco escreve)
create table public.product_ratings (
  product_id uuid primary key references public.products (id) on delete cascade,
  rating_avg numeric(2, 1) not null,
  rating_count integer not null,
  stars smallint[] not null -- quantas avaliações de 1 a 5 estrelas
);
alter table public.product_ratings enable row level security;
create policy "notas: leitura pública" on public.product_ratings for select to anon, authenticated using (true);
revoke insert, update, delete on public.product_ratings from anon, authenticated;

create function private.refresh_product_rating(_product_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare _n integer; _avg numeric; _stars smallint[];
begin
  select count(*), avg(rating), array[
      count(*) filter (where rating = 1), count(*) filter (where rating = 2), count(*) filter (where rating = 3),
      count(*) filter (where rating = 4), count(*) filter (where rating = 5)]::smallint[]
    into _n, _avg, _stars
  from public.product_reviews where product_id = _product_id and not hidden;
  if _n = 0 then
    delete from public.product_ratings where product_id = _product_id;
  else
    insert into public.product_ratings (product_id, rating_avg, rating_count, stars) values (_product_id, round(_avg, 1), _n, _stars)
    on conflict (product_id) do update set rating_avg = excluded.rating_avg, rating_count = excluded.rating_count, stars = excluded.stars;
  end if;
end $$;

create function private.product_reviews_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.refresh_product_rating(coalesce(new.product_id, old.product_id));
  return null;
end $$;
create trigger product_reviews_rating after insert or update or delete on public.product_reviews
  for each row execute function private.product_reviews_changed();

-- Comprador avalia (ou edita) um produto de um pedido entregue
create function public.review_product(_order_id uuid, _product_id uuid, _rating integer, _comment text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _o public.orders;
  _c text := nullif(btrim(regexp_replace(coalesce(_comment, ''), '\s+', ' ', 'g')), '');
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into _o from public.orders where id = _order_id and buyer_id = _uid;
  if _o.id is null or not exists (select 1 from public.order_items where order_id = _o.id and product_id = _product_id) then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if _o.status <> 'delivered' then raise exception 'not_delivered' using errcode = 'P0001'; end if;
  if coalesce(_o.delivered_at, _o.updated_at) < now() - interval '60 days' then raise exception 'review_window_closed' using errcode = 'P0001'; end if;
  if _rating is null or _rating not between 1 and 5 then raise exception 'invalid_rating' using errcode = 'P0001'; end if;
  if _c is not null and (char_length(_c) < 3 or char_length(_c) > 1000) then raise exception 'invalid_comment' using errcode = 'P0001'; end if;
  if _c is not null and private.has_contact(_c) then raise exception 'contact_not_allowed' using errcode = 'P0001'; end if;
  insert into public.product_reviews (product_id, store_id, order_id, buyer_id, buyer_alias, rating, comment)
  values (_product_id, _o.store_id, _o.id, _uid, coalesce(private.alias_for(_uid), 'Comprador'), _rating, _c)
  on conflict (order_id, product_id) do update set rating = excluded.rating, comment = excluded.comment, updated_at = now();
end $$;

-- Moderação esconde avaliação ofensiva (a nota sai da média)
create function public.hide_review(_review_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.staff_can('moderate') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.product_reviews set hidden = true where id = _review_id;
  if not found then raise exception 'review_not_found' using errcode = 'P0001'; end if;
end $$;

-- Reputação da loja (só números agregados; nada pessoal). Nível 1 a 5 a partir de 5 vendas.
create function public.store_reputation(_store_ids uuid[])
returns table (
  store_id uuid,
  sales integer,
  on_time_rate numeric,
  answer_rate numeric,
  rating_avg numeric,
  rating_count integer,
  level smallint
)
language sql stable security definer set search_path = '' as $$
  with s as (select unnest(_store_ids[1:50]) as id),
  o as (
    select s.id as store_id,
      count(*) filter (where o.status in ('paid', 'shipped', 'delivered'))::integer as sales,
      count(*) filter (where o.status = 'delivered' and o.delivered_at > now() - interval '365 days') as delivered,
      count(*) filter (where o.status = 'delivered' and o.delivered_at > now() - interval '365 days'
        and o.delivered_at <= o.created_at + make_interval(days => coalesce(o.shipping_days, 10) + 3)) as on_time
    from s left join public.orders o on o.store_id = s.id group by s.id
  ),
  q as (
    select s.id as store_id,
      count(pq.id) as asked,
      count(pq.id) filter (where pq.answered_at is not null and pq.answered_at <= pq.created_at + interval '24 hours') as fast
    from s left join public.product_questions pq on pq.store_id = s.id and not pq.hidden and pq.created_at > now() - interval '90 days'
      and pq.created_at < now() - interval '24 hours'
    group by s.id
  ),
  r as (
    select s.id as store_id, avg(pr.rating) as avg, count(pr.id)::integer as n
    from s left join public.product_reviews pr on pr.store_id = s.id and not pr.hidden group by s.id
  ),
  m as (
    select o.store_id, o.sales,
      case when o.delivered > 0 then round(o.on_time::numeric / o.delivered, 2) end as on_time_rate,
      case when q.asked > 0 then round(q.fast::numeric / q.asked, 2) end as answer_rate,
      case when r.n > 0 then round(r.avg, 1) end as rating_avg, r.n as rating_count
    from o join q using (store_id) join r using (store_id)
  )
  select m.store_id, m.sales, m.on_time_rate, m.answer_rate, m.rating_avg, m.rating_count,
    -- Sem vendas suficientes ou sem nenhum indicador ainda: sem nível ("loja nova")
    case when m.sales < 5 then null else (
      select case when count(x) = 0 then null else greatest(1, least(5, 1 + floor(avg(x) * 4.999)))::smallint end
      from unnest(array[m.on_time_rate, m.answer_rate, case when m.rating_count >= 3 then (m.rating_avg - 1) / 4 end]) x
    ) end as level
  from m
$$;

revoke execute on function public.review_product(uuid, uuid, integer, text), public.hide_review(bigint) from public, anon;
grant execute on function public.review_product(uuid, uuid, integer, text), public.hide_review(bigint) to authenticated;
grant execute on function public.store_reputation(uuid[]) to anon, authenticated;
revoke execute on function private.refresh_product_rating(uuid), private.product_reviews_changed() from public, anon, authenticated;
