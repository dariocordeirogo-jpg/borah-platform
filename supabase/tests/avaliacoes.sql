-- Teste das avaliações de produto e da reputação da loja. Roda numa transação e desfaz tudo (rollback).
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000f1','vend-av@teste.zexi','{"full_name":"Vendedor AV"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f2','ana-av@teste.zexi','{"full_name":"Ana Avalia"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f3','bia-av@teste.zexi','{"full_name":"Bia"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f4','mod-av@teste.zexi','{"full_name":"Moderadora"}','authenticated','authenticated');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000f4', 'moderator');
create temp table r(test text, ok boolean) on commit drop;
create temp table ids(k text primary key, v text) on commit drop;
grant all on r, ids to authenticated, anon;
create function pg_temp.as_user(_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.err(_sql text) returns text language plpgsql as $$
begin execute _sql; return null; exception when others then return sqlerrm; end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
insert into ids values ('store', public.create_store('Loja AV', 'loja-av-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store'), 'Jaqueta AV', 40000, 50, 'active');
insert into ids select 'p', id from public.products where title = 'Jaqueta AV';
reset role;

-- Pedidos de teste direto na tabela (como superusuário): Ana recebeu no prazo; Bia ainda não recebeu
create function pg_temp.order_for(_buyer uuid, _status public.order_status, _created timestamptz, _delivered timestamptz) returns uuid
language plpgsql as $$
declare _id uuid;
begin
  insert into public.orders (buyer_id, store_id, status, subtotal_cents, shipping_cents, total_cents, shipping_address, shipping_days, created_at, delivered_at)
  values (_buyer, (select v::uuid from ids where k='store'), _status, 40000, 0, 40000, '{}'::jsonb, 5, _created, _delivered)
  returning id into _id;
  insert into public.order_items (order_id, product_id, title, unit_price_cents, quantity)
  values (_id, (select v::uuid from ids where k='p'), 'Jaqueta AV', 40000, 1);
  return _id;
end $$;
insert into ids values
  ('o_ana', pg_temp.order_for('00000000-0000-0000-0000-0000000000f2', 'delivered', now() - interval '6 days', now() - interval '1 day')),
  ('o_bia', pg_temp.order_for('00000000-0000-0000-0000-0000000000f3', 'shipped', now() - interval '2 days', null)),
  ('o_velho', pg_temp.order_for('00000000-0000-0000-0000-0000000000f2', 'delivered', now() - interval '100 days', now() - interval '90 days'));

set local role authenticated;
-- Quem não recebeu não avalia; outra pessoa não avalia o pedido alheio
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
insert into r select 'pedido não entregue não avalia',
  pg_temp.err(format('select public.review_product(%L, %L, 5, null)', (select v from ids where k='o_bia'), (select v from ids where k='p'))) = 'not_delivered';
insert into r select 'pedido de outra pessoa não avalia',
  pg_temp.err(format('select public.review_product(%L, %L, 5, null)', (select v from ids where k='o_ana'), (select v from ids where k='p'))) = 'order_not_found';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
insert into r select 'nota fora de 1 a 5 recusada',
  pg_temp.err(format('select public.review_product(%L, %L, 6, null)', (select v from ids where k='o_ana'), (select v from ids where k='p'))) = 'invalid_rating';
insert into r select 'prazo de 60 dias depois da entrega',
  pg_temp.err(format('select public.review_product(%L, %L, 5, null)', (select v from ids where k='o_velho'), (select v from ids where k='p'))) = 'review_window_closed';
select public.review_product((select v::uuid from ids where k='o_ana'), (select v::uuid from ids where k='p'), 4, '  Muito boa,  veste bem ');
insert into r select 'avaliação gravada com apelido e comentário limpo', rating = 4 and comment = 'Muito boa, veste bem' and buyer_alias like 'A***%'
  from public.product_reviews where order_id = (select v::uuid from ids where k='o_ana');
insert into r select 'média do produto calculada', rating_avg = 4.0 and rating_count = 1 and stars = array[0,0,0,1,0]::smallint[]
  from public.product_ratings where product_id = (select v::uuid from ids where k='p');
select public.review_product((select v::uuid from ids where k='o_ana'), (select v::uuid from ids where k='p'), 5, 'Ótimo! me liga 62 99999-8888');
insert into r select 'contato no comentário fica oculto', comment = 'Ótimo! [contato oculto] [contato oculto]'
  from public.product_reviews where order_id = (select v::uuid from ids where k='o_ana');
insert into r select 'editar a avaliação atualiza a média (sem duplicar)', rating_avg = 5.0 and rating_count = 1
  from public.product_ratings where product_id = (select v::uuid from ids where k='p');
insert into r select 'ninguém escreve a média direto',
  pg_temp.err(format('update public.product_ratings set rating_avg = 5, rating_count = 999 where product_id = %L', (select v from ids where k='p'))) is not null
  or (select rating_count from public.product_ratings where product_id = (select v::uuid from ids where k='p')) = 1;
insert into r select 'ninguém grava avaliação direto',
  pg_temp.err(format('insert into public.product_reviews (product_id, store_id, order_id, buyer_id, buyer_alias, rating) values (%L, %L, %L, %L, %L, 5)',
    (select v from ids where k='p'), (select v from ids where k='store'), (select v from ids where k='o_ana'), '00000000-0000-0000-0000-0000000000f2', 'x')) ~ 'permission denied|row-level security';

-- A loja não muda nota (nem a própria pela tabela de produtos)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
insert into r select 'loja não esconde avaliação', pg_temp.err(format('select public.hide_review(%L)',
  (select id from public.product_reviews where order_id = (select v::uuid from ids where k='o_ana')))) is not null;

-- Visitante lê avaliações e notas
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r select 'visitante lê avaliações', count(*) = 1 from public.product_reviews where product_id = (select v::uuid from ids where k='p');
insert into r select 'visitante lê a nota', count(*) = 1 from public.product_ratings where product_id = (select v::uuid from ids where k='p');
insert into r select 'visitante não avalia', pg_temp.err(format('select public.review_product(%L, %L, 1, null)', (select v from ids where k='o_ana'), (select v from ids where k='p'))) like '%permission denied%';

-- Reputação (detalhes em supabase/tests/regras.sql): nota média e atendimento aparecem junto com a cor
insert into r select 'reputação traz nota e vendas', sales = 0 and color is null and rating_avg = 5.0 and rating_count = 1
  from public.store_reputation(array[(select v::uuid from ids where k='store')]);
reset role;
insert into public.product_questions (product_id, store_id, asker_id, asker_alias, body, answer, answered_at, created_at)
values ((select v::uuid from ids where k='p'), (select v::uuid from ids where k='store'), '00000000-0000-0000-0000-0000000000f3', 'B***a', 'Tem tamanho G?', 'Tem sim', now() - interval '47 hours', now() - interval '48 hours');
set local role anon;
insert into r select 'atendimento: pergunta respondida em 24 horas', answer_rate = 1.00
  from public.store_reputation(array[(select v::uuid from ids where k='store')]);

-- Moderação esconde avaliação: sai da média
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f4');
select public.hide_review((select id from public.product_reviews where order_id = (select v::uuid from ids where k='o_ana')));
reset role;
insert into r select 'avaliação escondida sai da média', not exists (select 1 from public.product_ratings where product_id = (select v::uuid from ids where k='p'));

select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where not coalesce(ok, false)) as falhas from r;
rollback;
