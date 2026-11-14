-- Teste da atribuição de vendas à live. Transação + rollback.
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000e1','vend-at@teste.zexi','{"full_name":"Vendedor AT"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000e2','comp-at@teste.zexi','{"full_name":"Compradora AT"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000e3','vend2-at@teste.zexi','{"full_name":"Outra Loja AT"}','authenticated','authenticated');
create temp table r(test text, ok boolean) on commit drop;
create temp table ids(k text primary key, v text) on commit drop;
grant all on r, ids to authenticated, anon;
create function pg_temp.as_user(_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
insert into ids values ('store', public.create_store('Loja AT', 'loja-at-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values
  ((select v::uuid from ids where k='store'), 'Na live AT', 10000, 5, 'active'),
  ((select v::uuid from ids where k='store'), 'Fora da live AT', 5000, 5, 'active');
insert into ids select 'na', id from public.products where title = 'Na live AT';
insert into ids select 'fora', id from public.products where title = 'Fora da live AT';
insert into ids values ('live', public.create_live('Live AT', null, now() + interval '1 minute', array[(select v from ids where k='na')]::uuid[]));
select public.start_live((select v::uuid from ids where k='live'));

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
insert into ids values ('store2', public.create_store('Outra AT', 'outra-at-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store2'), 'Outra loja AT', 3000, 5, 'active');
insert into ids select 'outro', id from public.products where title = 'Outra loja AT';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
insert into public.addresses (user_id, recipient, cep, street, number, district, city, state)
  values ('00000000-0000-0000-0000-0000000000e2','Ana','01001000','Praça da Sé','1','Sé','São Paulo','SP');
insert into public.cart_items (user_id, product_id, quantity, live_id) values
  ('00000000-0000-0000-0000-0000000000e2', (select v::uuid from ids where k='na'), 1, (select v::uuid from ids where k='live')),
  ('00000000-0000-0000-0000-0000000000e2', (select v::uuid from ids where k='fora'), 1, (select v::uuid from ids where k='live')),
  ('00000000-0000-0000-0000-0000000000e2', (select v::uuid from ids where k='outro'), 1, (select v::uuid from ids where k='live'));
insert into r select 'produto da live fica marcado', live_id is not null from public.cart_items where product_id = (select v::uuid from ids where k='na');
insert into r select 'produto fora da live perde a marca', live_id is null from public.cart_items where product_id = (select v::uuid from ids where k='fora');
insert into r select 'produto de outra loja perde a marca', live_id is null from public.cart_items where product_id = (select v::uuid from ids where k='outro');

select public.checkout((select id from public.addresses where user_id = '00000000-0000-0000-0000-0000000000e2'));
insert into r select 'pedido da loja da live herda a live', live_id = (select v::uuid from ids where k='live')
  from public.orders where buyer_id = '00000000-0000-0000-0000-0000000000e2' and store_id = (select v::uuid from ids where k='store');
insert into r select 'pedido de outra loja sem live', live_id is null
  from public.orders where buyer_id = '00000000-0000-0000-0000-0000000000e2' and store_id = (select v::uuid from ids where k='store2');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
insert into r select 'loja vê o pedido atribuído à live', count(*) = 1 from public.orders where live_id = (select v::uuid from ids where k='live');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
insert into r select 'outra loja não vê pedidos da live alheia', count(*) = 0 from public.orders where live_id = (select v::uuid from ids where k='live');

-- Live encerrada não marca mais
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select public.end_live((select v::uuid from ids where k='live'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
insert into public.cart_items (user_id, product_id, quantity, live_id) values
  ('00000000-0000-0000-0000-0000000000e2', (select v::uuid from ids where k='na'), 1, (select v::uuid from ids where k='live'));
insert into r select 'live encerrada não marca o carrinho', live_id is null from public.cart_items where product_id = (select v::uuid from ids where k='na');

reset role;
select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where ok is not true) as falhas from r;
rollback;
