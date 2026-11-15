-- Regras da Zexi
-- 1) Proibido trocar contato fora da plataforma: telefone, e-mail, links e redes sociais, de qualquer forma.
--    O banco OCULTA automaticamente o trecho (vira "[contato oculto]") em todo texto escrito por usuários e lojas;
--    o site avisa da proibição. Vale para o que for gravado a partir de agora (textos antigos não são alterados).
-- 2) Reputação da loja a partir das 5 primeiras vendas, em verde, amarela ou vermelha, pelos limites de
--    reclamações (10%), cancelamentos pela loja (5%) e atrasos no envio (20%). Reclamação resolvida em até
--    48 horas não pesa. Período: último ano (ou 60 dias para quem vendeu 101+ nesse período).
--    Limites ajustáveis em private.reputation_settings.
-- 3) Reclamação do comprador no pedido (base do indicador de reclamações).

-- ============ 1) Contato oculto ============
create function private.mask_contact(_t text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  _r text := _t;
  _m constant text := '[contato oculto]';
begin
  if _r is null or _r = '' then return _r; end if;
  -- e-mail (também escrito com "arroba" / "ponto com")
  _r := regexp_replace(_r, '[[:alnum:]._%+-]+(@|[[:space:]]*(\(at\)|\[at\]|\marroba\M)[[:space:]]*)[[:alnum:]-]+([[:space:]]*(\.|\mponto\M)[[:space:]]*[[:alnum:]-]+)+', _m, 'gi');
  -- links e domínios
  _r := regexp_replace(_r, '(https?://|www\.)[^[:space:]]+', _m, 'gi');
  _r := regexp_replace(_r, '\m[[:alnum:]-]+\.(com|net|org|io|me|app|link|ly|shop|store|site|online|info|biz)(\.br)?\M(/[^[:space:]]*)?', _m, 'gi');
  _r := regexp_replace(_r, '\m[[:alnum:]-]+\.(com|net|org)?\.?br\M(/[^[:space:]]*)?', _m, 'gi');
  -- telefone: 8 ou mais dígitos, com ou sem espaços, pontos, traços e parênteses (inclui +55)
  _r := regexp_replace(_r, '\+?\(?[0-9]([[:space:]().-]{0,2}[0-9]){7,}', _m, 'g');
  -- número escrito por extenso (7 ou mais algarismos seguidos)
  _r := regexp_replace(_r, '(\m(zero|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|meia|sete|oito|nove)\M[[:space:],.-]*){7,}', _m || ' ', 'gi');
  -- @perfil
  _r := regexp_replace(_r, '(^|[[:space:]])@[[:alnum:]._]{3,}', '\1' || _m, 'g');
  -- redes sociais e aplicativos de mensagem
  _r := regexp_replace(_r, '\m(whats[[:space:]]?app|whats|wpp|zap[[:space:]]?zap|zap|telegram|instagram|insta|facebook|fb|tik[[:space:]]?tok|twitter|kwai|linkedin|discord|youtube|messenger|signal)\M', _m, 'gi');
  -- convite para contato fora ("meu número", "me chama no privado", "me liga")
  _r := regexp_replace(_r, '\m(meu|minha)[[:space:]]+(n[uú]mero|telefone|celular|fone|e-?mail|contato)\M', _m, 'gi');
  _r := regexp_replace(_r, '\m(seu|sua)[[:space:]]+(telefone|celular|fone|e-?mail|contato)\M', _m, 'gi');
  _r := regexp_replace(_r, '\m((me[[:space:]]+(chama|liga|ligue|manda[[:space:]]+mensagem))([[:space:]]+n[oa][[:space:]]+(pv|privado|direct|inbox|dm|direto))?|chama[[:space:]]+n[oa][[:space:]]+(pv|privado|direct|inbox|dm|direto))\M', _m, 'gi');
  return _r;
end $$;

-- Há contato na mensagem? (o site usa para avisar da proibição; quem oculta é sempre o banco)
create or replace function private.has_contact(_t text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(private.mask_contact(_t) is distinct from _t, false)
$$;

create function public.contact_hidden(_text text) returns boolean
language sql immutable security definer set search_path = '' as $$
  select private.has_contact(left(coalesce(_text, ''), 20000))
$$;

-- Gatilho genérico: oculta contato nas colunas indicadas (argumentos do gatilho)
create function private.mask_contact_columns() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  _col text;
  _patch jsonb := '{}'::jsonb;
  _row jsonb := to_jsonb(new);
begin
  foreach _col in array tg_argv loop
    if _row ? _col and jsonb_typeof(_row -> _col) = 'string' then
      _patch := _patch || jsonb_build_object(_col, private.mask_contact(_row ->> _col));
    end if;
  end loop;
  return jsonb_populate_record(new, _patch);
end $$;

create trigger products_mask_contact before insert or update of title, description on public.products
  for each row execute function private.mask_contact_columns('title', 'description');
create trigger stores_mask_contact before insert or update of name, description on public.stores
  for each row execute function private.mask_contact_columns('name', 'description');
create trigger lives_mask_contact before insert or update of title, description on public.lives
  for each row execute function private.mask_contact_columns('title', 'description');
create trigger auctions_mask_contact before insert or update of title on public.auctions
  for each row execute function private.mask_contact_columns('title');
create trigger videos_mask_contact before insert or update of caption on public.videos
  for each row execute function private.mask_contact_columns('caption');
create trigger live_messages_mask_contact before insert or update of body on public.live_messages
  for each row execute function private.mask_contact_columns('body');
create trigger product_questions_mask_contact before insert or update of body, answer on public.product_questions
  for each row execute function private.mask_contact_columns('body', 'answer');
create trigger product_reviews_mask_contact before insert or update of comment on public.product_reviews
  for each row execute function private.mask_contact_columns('comment');
create trigger live_social_events_mask_contact before insert or update of nickname, body on public.live_social_events
  for each row execute function private.mask_contact_columns('nickname', 'body');
create trigger profiles_mask_contact before insert or update of display_name, bio on public.profiles
  for each row execute function private.mask_contact_columns('display_name', 'bio');

-- Perguntas, respostas e avaliações: em vez de recusar, gravam com o contato oculto (o gatilho oculta)
create or replace function public.ask_question(_product_id uuid, _body text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _b text := btrim(regexp_replace(coalesce(_body, ''), '\s+', ' ', 'g'));
  _p record;
  _id bigint;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if char_length(_b) < 5 or char_length(_b) > 500 then raise exception 'invalid_question' using errcode = 'P0001'; end if;
  select p.id, p.status, p.store_id, s.owner_id into _p from public.products p join public.stores s on s.id = p.store_id where p.id = _product_id;
  if _p.id is null or _p.status <> 'active' then raise exception 'product_not_found' using errcode = 'P0001'; end if;
  if _p.owner_id = _uid then raise exception 'own_product' using errcode = 'P0001'; end if;
  if (select count(*) from public.product_questions where asker_id = _uid and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too_many_questions' using errcode = 'P0001';
  end if;
  insert into public.product_questions (product_id, store_id, asker_id, asker_alias, body)
  values (_p.id, _p.store_id, _uid, coalesce(private.alias_for(_uid), 'Comprador'), _b)
  returning id into _id;
  perform private.enqueue('email', 'question.received', (select email from auth.users where id = _p.owner_id),
    jsonb_build_object('question_id', _id, 'product_id', _p.id));
  return _id;
end $$;

create or replace function public.answer_question(_question_id bigint, _answer text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  _a text := btrim(coalesce(_answer, ''));
  _q public.product_questions;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into _q from public.product_questions where id = _question_id for update;
  if _q.id is null or _q.store_id is distinct from private.my_store_id() then raise exception 'question_not_found' using errcode = 'P0001'; end if;
  if char_length(_a) < 2 or char_length(_a) > 1000 then raise exception 'invalid_answer' using errcode = 'P0001'; end if;
  update public.product_questions set answer = _a, answered_at = coalesce(answered_at, now()) where id = _q.id;
  if _q.answer is null then
    perform private.enqueue('email', 'question.answered', (select email from auth.users where id = _q.asker_id),
      jsonb_build_object('question_id', _q.id, 'product_id', _q.product_id));
  end if;
end $$;

create or replace function public.review_product(_order_id uuid, _product_id uuid, _rating integer, _comment text) returns void
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
  insert into public.product_reviews (product_id, store_id, order_id, buyer_id, buyer_alias, rating, comment)
  values (_product_id, _o.store_id, _o.id, _uid, coalesce(private.alias_for(_uid), 'Comprador'), _rating, _c)
  on conflict (order_id, product_id) do update set rating = excluded.rating, comment = excluded.comment, updated_at = now();
end $$;

-- ============ 3) Reclamações ============
create table public.order_complaints (
  id bigint generated always as identity primary key,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('not_received', 'not_as_described', 'damaged', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index order_complaints_store_idx on public.order_complaints (store_id, created_at desc);
alter table public.order_complaints enable row level security;
create policy "reclamações: comprador, loja e equipe" on public.order_complaints for select to authenticated using (
  buyer_id = (select auth.uid()) or store_id = (select private.my_store_id()) or (select private.staff_can('moderate'))
);
revoke insert, update, delete on public.order_complaints from anon, authenticated;
create trigger order_complaints_mask_contact before insert or update of details on public.order_complaints
  for each row execute function private.mask_contact_columns('details');

alter table public.order_events drop constraint order_events_kind_check;
alter table public.order_events add constraint order_events_kind_check
  check (kind in ('created', 'paid', 'shipped', 'tracking_updated', 'delivered', 'cancelled', 'complaint', 'complaint_resolved'));

-- Comprador abre reclamação de um pedido pago, enviado ou entregue (até 30 dias depois da entrega); uma por pedido
create function public.open_complaint(_order_id uuid, _reason text, _details text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _o public.orders;
  _d text := nullif(btrim(regexp_replace(coalesce(_details, ''), '\s+', ' ', 'g')), '');
  _id bigint;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into _o from public.orders where id = _order_id and buyer_id = _uid;
  if _o.id is null then raise exception 'order_not_found' using errcode = 'P0001'; end if;
  if _o.status not in ('paid', 'shipped', 'delivered') then raise exception 'order_not_complainable' using errcode = 'P0001'; end if;
  if _o.status = 'delivered' and coalesce(_o.delivered_at, _o.updated_at) < now() - interval '30 days' then
    raise exception 'complaint_window_closed' using errcode = 'P0001';
  end if;
  if _reason not in ('not_received', 'not_as_described', 'damaged', 'other') then raise exception 'invalid_reason' using errcode = 'P0001'; end if;
  if _d is not null and char_length(_d) > 1000 then raise exception 'invalid_details' using errcode = 'P0001'; end if;
  if exists (select 1 from public.order_complaints where order_id = _o.id) then raise exception 'complaint_exists' using errcode = 'P0001'; end if;
  insert into public.order_complaints (order_id, store_id, buyer_id, reason, details)
  values (_o.id, _o.store_id, _uid, _reason, _d) returning id into _id;
  insert into public.order_events (order_id, kind, detail) values (_o.id, 'complaint', jsonb_build_object('reason', _reason));
  perform private.enqueue('email', 'complaint.opened',
    (select u.email from public.stores s join auth.users u on u.id = s.owner_id where s.id = _o.store_id),
    jsonb_build_object('order_id', _o.id, 'complaint_id', _id));
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (_uid, 'order.complaint', 'order', _o.id::text);
  return _id;
end $$;

-- Comprador (ou a equipe) marca como resolvida. Resolvida em até 48 horas não pesa na cor da reputação
create function public.resolve_complaint(_complaint_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.order_complaints set status = 'resolved', resolved_at = now()
  where id = _complaint_id and status = 'open' and (buyer_id = auth.uid() or private.staff_can('moderate'));
  if not found then raise exception 'complaint_not_found' using errcode = 'P0001'; end if;
  insert into public.order_events (order_id, kind) select order_id, 'complaint_resolved' from public.order_complaints where id = _complaint_id;
end $$;

-- ============ 2) Reputação verde / amarela / vermelha ============
create table private.reputation_settings (
  id boolean primary key default true check (id),
  min_sales integer not null default 5,
  window_days integer not null default 365,
  complaint_limit numeric not null default 0.10,
  cancel_limit numeric not null default 0.05,
  delay_limit numeric not null default 0.20,
  -- Amarela a partir desta fração do limite (ex.: 0,5 → amarela com 5% de reclamações, vermelha acima de 10%)
  warn_ratio numeric not null default 0.5,
  -- Prazo para despachar depois do pagamento (dias corridos)
  handling_days integer not null default 3,
  -- Reclamação resolvida em até estas horas não pesa na cor (continua registrada)
  quick_resolve_hours integer not null default 48,
  -- Loja com muitas vendas é medida só pelo período curto (como nos grandes marketplaces)
  short_window_days integer not null default 60,
  short_window_min_sales integer not null default 101
);
insert into private.reputation_settings default values;
alter table private.reputation_settings enable row level security;

drop function public.store_reputation(uuid[]);
create function public.store_reputation(_store_ids uuid[])
returns table (
  store_id uuid,
  sales integer,
  complaint_rate numeric,
  cancel_rate numeric,
  delay_rate numeric,
  answer_rate numeric,
  rating_avg numeric,
  rating_count integer,
  color text
)
language sql stable security definer set search_path = '' as $$
  with cfg as (select * from private.reputation_settings where id),
  s as (select unnest(_store_ids[1:50]) as id),
  -- Vendas do último ano: pedidos que chegaram a ser pagos (inclui os cancelados depois)
  paid as (
    select o.id, o.store_id, o.status, o.shipped_at, pay.paid_at
    from public.orders o
    join lateral (select min(p.paid_at) as paid_at from public.payments p where p.order_id = o.id and p.paid_at is not null) pay on true
    cross join cfg
    where o.store_id = any (_store_ids[1:50]) and pay.paid_at is not null and pay.paid_at > now() - make_interval(days => cfg.window_days)
  ),
  -- Período de medição: 60 dias para quem vendeu 101 ou mais nesse período; senão, o último ano
  win as (
    select s.id as store_id,
      case when count(x.id) filter (where x.paid_at > now() - make_interval(days => cfg.short_window_days)) >= cfg.short_window_min_sales
        then cfg.short_window_days else cfg.window_days end as days
    from s cross join cfg left join paid x on x.store_id = s.id group by s.id, cfg.short_window_days, cfg.short_window_min_sales, cfg.window_days
  ),
  sold as (
    select x.* from paid x join win w on w.store_id = x.store_id where x.paid_at > now() - make_interval(days => w.days)
  ),
  o as (
    select s.id as store_id,
      count(x.id)::integer as sales,
      count(x.id) filter (where exists (select 1 from public.order_complaints c where c.order_id = x.id
        and (c.resolved_at is null or c.resolved_at > c.created_at + make_interval(hours => (select quick_resolve_hours from cfg))))) as complaints,
      count(x.id) filter (where exists (select 1 from public.audit_logs a where a.action = 'order.refund_requested' and a.entity_id = x.id::text)) as cancels,
      count(x.id) filter (where
        not exists (select 1 from public.audit_logs a where a.action = 'order.refund_requested' and a.entity_id = x.id::text)
        and coalesce(x.shipped_at, case when x.status = 'paid' then now() end) > x.paid_at + make_interval(days => (select handling_days from cfg))) as delays
    from s left join sold x on x.store_id = s.id group by s.id
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
      case when o.sales > 0 then round(o.complaints::numeric / o.sales, 3) end as complaint_rate,
      case when o.sales > 0 then round(o.cancels::numeric / o.sales, 3) end as cancel_rate,
      case when o.sales > 0 then round(o.delays::numeric / o.sales, 3) end as delay_rate,
      case when q.asked > 0 then round(q.fast::numeric / q.asked, 2) end as answer_rate,
      case when r.n > 0 then round(r.avg, 1) end as rating_avg, r.n as rating_count
    from o join q using (store_id) join r using (store_id)
  )
  select m.store_id, m.sales, m.complaint_rate, m.cancel_rate, m.delay_rate, m.answer_rate, m.rating_avg, m.rating_count,
    case
      when m.sales < cfg.min_sales then null
      when m.complaint_rate > cfg.complaint_limit or m.cancel_rate > cfg.cancel_limit or m.delay_rate > cfg.delay_limit then 'red'
      when m.complaint_rate > cfg.complaint_limit * cfg.warn_ratio or m.cancel_rate > cfg.cancel_limit * cfg.warn_ratio
        or m.delay_rate > cfg.delay_limit * cfg.warn_ratio then 'yellow'
      else 'green'
    end as color
  from m cross join cfg
$$;

revoke execute on function public.open_complaint(uuid, text, text), public.resolve_complaint(bigint) from public, anon;
grant execute on function public.open_complaint(uuid, text, text), public.resolve_complaint(bigint) to authenticated;
grant execute on function public.store_reputation(uuid[]), public.contact_hidden(text) to anon, authenticated;
revoke execute on function private.mask_contact(text), private.mask_contact_columns() from public, anon, authenticated;
