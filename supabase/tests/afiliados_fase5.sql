-- Teste do Indique e ganhe (Fase 5). Roda numa transação e desfaz tudo (rollback).
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000a5','vend5@teste.livelance','{"full_name":"Vendedor Cinco"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b5','ana5@teste.livelance','{"full_name":"Ana Souza"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c5','joao5@teste.livelance','{"full_name":"João Indicador"}','authenticated','authenticated');
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
-- Vendedor com loja e produto; também vira afiliado
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5');
insert into ids values ('store', public.create_store('Loja Cinco', 'loja-cinco-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store'), 'Caixa de som', 20000, 10, 'active');
insert into ids select 'p', id from public.products where title = 'Caixa de som';
insert into ids values ('code_vend', public.become_affiliate());

-- João vira afiliado
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c5');
insert into ids values ('code', public.become_affiliate());
insert into r select 'código gerado do nome, sem acento', (select v from ids where k='code') ~ '^joao[0-9a-f]{4}$';
insert into r select 'virar afiliado de novo devolve o mesmo código', public.become_affiliate() = (select v from ids where k='code');
insert into r select 'ganhou o papel de afiliado', exists (select 1 from public.user_roles where user_id = '00000000-0000-0000-0000-0000000000c5' and role = 'affiliate');
insert into r select 'afiliado não altera o próprio código', pg_temp.err($q$update public.affiliates set code = 'outro1234'$q$) like '%permission denied%';
insert into r select 'afiliado não cria comissão direto',
  pg_temp.err($q$insert into public.affiliate_commissions (order_id, order_number, affiliate_id, base_cents, rate_bps, amount_cents) values (gen_random_uuid(), 1, auth.uid(), 1, 1, 1)$q$) like '%permission denied%';

-- Cliques (anônimo)
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r select 'clique em código válido conta', public.track_referral(upper((select v from ids where k='code')));
select public.track_referral((select v from ids where k='code'));
insert into r select 'código inexistente não conta', not public.track_referral('naoexiste99');
insert into r select 'código malformado não conta', not public.track_referral('../x');
insert into r select 'anônimo não vira afiliado', pg_temp.err('select public.become_affiliate()') like '%permission denied%';
insert into r select 'programa público: 3% e 30 dias', public.affiliate_program() = '{"rate_bps": 300, "cookie_days": 30}'::jsonb;
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c5');
insert into r select 'afiliado vê 2 cliques hoje', sum(clicks) = 2 from public.affiliate_clicks;

-- Ana compra com o código do João
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b5');
insert into public.addresses (user_id, recipient, cep, street, number, district, city, state)
  values ('00000000-0000-0000-0000-0000000000b5','Ana','01001000','Praça da Sé','1','Sé','São Paulo','SP');
insert into ids select 'addr', id from public.addresses;
insert into public.cart_items (user_id, product_id, quantity) values ('00000000-0000-0000-0000-0000000000b5', (select v::uuid from ids where k='p'), 2);
insert into ids select 'o1', (public.checkout_with_ref((select v::uuid from ids where k='addr'), (select v from ids where k='code')))[1];
insert into r select 'compradora não vê a comissão', count(*) = 0 from public.affiliate_commissions;
insert into r select 'compradora não vê clicks alheios', count(*) = 0 from public.affiliate_clicks;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c5');
insert into r select 'comissão de 3% registrada pendente', base_cents = 40000 and amount_cents = 1200 and status = 'pending'
  from public.affiliate_commissions where order_id = (select v::uuid from ids where k='o1');
insert into r select 'afiliado não vê o pedido da compradora', count(*) = 0 from public.orders;

-- Pedido pago → comissão confirmada
reset role;
update public.orders set status = 'paid' where id = (select v::uuid from ids where k='o1');
insert into r select 'pedido pago confirma a comissão', status = 'confirmed' from public.affiliate_commissions where order_id = (select v::uuid from ids where k='o1');
update public.orders set status = 'cancelled' where id = (select v::uuid from ids where k='o1');
insert into r select 'reembolso/cancelamento cancela a comissão', status = 'cancelled' from public.affiliate_commissions where order_id = (select v::uuid from ids where k='o1');
update public.orders set status = 'paid' where id = (select v::uuid from ids where k='o1');
insert into r select 'comissão cancelada não volta sozinha', status = 'cancelled' from public.affiliate_commissions where order_id = (select v::uuid from ids where k='o1');

-- Autoindicação e indicação da própria loja não geram comissão
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c5');
insert into public.addresses (user_id, recipient, cep, street, number, district, city, state)
  values ('00000000-0000-0000-0000-0000000000c5','João','01001000','Rua','1','Centro','São Paulo','SP');
insert into public.cart_items (user_id, product_id, quantity) values ('00000000-0000-0000-0000-0000000000c5', (select v::uuid from ids where k='p'), 1);
insert into ids select 'o2', (public.checkout_with_ref((select id from public.addresses where user_id = '00000000-0000-0000-0000-0000000000c5'), (select v from ids where k='code')))[1];
insert into r select 'autoindicação não gera comissão', count(*) = 0 from public.affiliate_commissions where order_id = (select v::uuid from ids where k='o2');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b5');
insert into public.cart_items (user_id, product_id, quantity) values ('00000000-0000-0000-0000-0000000000b5', (select v::uuid from ids where k='p'), 1);
insert into ids select 'o3', (public.checkout_with_ref((select v::uuid from ids where k='addr'), (select v from ids where k='code_vend')))[1];
reset role;
insert into r select 'vendedor indicando a própria loja não ganha', count(*) = 0 from public.affiliate_commissions where order_id = (select v::uuid from ids where k='o3');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b5');
insert into public.cart_items (user_id, product_id, quantity) values ('00000000-0000-0000-0000-0000000000b5', (select v::uuid from ids where k='p'), 1);
insert into ids select 'o4', (public.checkout_with_ref((select v::uuid from ids where k='addr'), 'codigoinvalido'))[1];
insert into r select 'código inválido não impede a compra', (select v from ids where k='o4') is not null;
reset role;
insert into r select 'código inválido não gera comissão', count(*) = 0 from public.affiliate_commissions where order_id = (select v::uuid from ids where k='o4');

select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where not ok) as falhas from r;
rollback;
