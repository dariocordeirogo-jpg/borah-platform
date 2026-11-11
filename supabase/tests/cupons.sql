-- Teste dos cupons. Roda numa transação e desfaz tudo (rollback).
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000c1','vendc@teste.livelance','{"full_name":"Vendedora C"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c2','vendd@teste.livelance','{"full_name":"Vendedor D"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c3','compc@teste.livelance','{"full_name":"Compradora"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c4','afic@teste.livelance','{"full_name":"Afiliado"}','authenticated','authenticated');
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
-- Duas lojas com um produto cada
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into ids values ('store_c', public.create_store('Loja Cupom', 'loja-cupom-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store_c'), 'Bolsa cupom', 10000, 10, 'active');
insert into ids select 'pc', id from public.products where title = 'Bolsa cupom';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
insert into ids values ('store_d', public.create_store('Loja Dois', 'loja-dois-cupom-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store_d'), 'Cinto dois', 5000, 10, 'active');
insert into ids select 'pd', id from public.products where title = 'Cinto dois';

-- Loja C cria cupons
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into ids values ('cup10', public.create_coupon('dez10', 'percent', 10, 5000, 2)::text);
insert into r select 'código vira maiúsculo', code = 'DEZ10' from public.coupons where id = (select v::uuid from ids where k='cup10');
insert into r select 'código repetido recusado', pg_temp.err($q$select public.create_coupon('DEZ10', 'fixed', 500)$q$) = 'coupon_code_taken';
insert into r select 'código com símbolo recusado', pg_temp.err($q$select public.create_coupon('DEZ-10', 'percent', 10)$q$) = 'coupon_code_invalid';
insert into r select 'percentual acima de 90 recusado', pg_temp.err($q$select public.create_coupon('TUDO', 'percent', 95)$q$) = 'coupon_value_invalid';
insert into r select 'validade no passado recusada',
  pg_temp.err($q$select public.create_coupon('VELHO', 'percent', 5, 0, null, null, now() - interval '1 day')$q$) = 'coupon_dates_invalid';
insert into ids values ('cupfix', public.create_coupon('MENOS200', 'fixed', 20000)::text);

-- Outra loja não vê nem desliga cupom alheio
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
insert into r select 'outra loja não lê cupons alheios', count(*) = 0 from public.coupons;
insert into r select 'outra loja não desliga cupom alheio',
  pg_temp.err(format('select public.set_coupon_active(%L, false)', (select v from ids where k='cup10'))) = 'coupon_not_found';
insert into ids values ('cupd', public.create_coupon('DOIS5', 'fixed', 500)::text);

-- Compradora: carrinho com as duas lojas
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
insert into r select 'compradora não lista cupons', count(*) = 0 from public.coupons;
insert into public.addresses (user_id, recipient, cep, street, number, district, city, state)
  values ('00000000-0000-0000-0000-0000000000c3','Compradora','01001000','Praça da Sé','1','Sé','São Paulo','SP');
insert into ids select 'addr', id from public.addresses where user_id = '00000000-0000-0000-0000-0000000000c3';
insert into public.cart_items (user_id, product_id, quantity) values
  ('00000000-0000-0000-0000-0000000000c3', (select v::uuid from ids where k='pc'), 1),
  ('00000000-0000-0000-0000-0000000000c3', (select v::uuid from ids where k='pd'), 1);

insert into r select 'prévia mostra loja e desconto',
  (public.check_coupon(' dez10 ')->>'discount_cents')::int = 1000 and public.check_coupon('DEZ10')->>'store_name' = 'Loja Cupom';
insert into r select 'cupom inexistente', pg_temp.err($q$select public.check_coupon('NADA')$q$) = 'coupon_invalid';
insert into r select 'cupom da outra loja também vale na prévia', pg_temp.err($q$select public.check_coupon('DOIS5')$q$) is null;

-- Cupom inválido desfaz o checkout inteiro (carrinho continua)
insert into r select 'checkout com cupom inválido falha',
  pg_temp.err(format('select public.place_order(%L, null, %L)', (select v from ids where k='addr'), 'NADA')) = 'coupon_invalid';
insert into r select 'carrinho intacto após falha', count(*) = 2 from public.cart_items where user_id = '00000000-0000-0000-0000-0000000000c3';
insert into r select 'nenhum pedido criado após falha', count(*) = 0 from public.orders where buyer_id = '00000000-0000-0000-0000-0000000000c3';

-- Checkout com cupom da loja C e indicação
reset role;
insert into public.affiliates (user_id, code) values ('00000000-0000-0000-0000-0000000000c4', 'afcupom1');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
create temp table orders_made on commit drop as
  select unnest(public.place_order((select v::uuid from ids where k='addr'), 'afcupom1', 'dez10')) as id;
grant all on orders_made to authenticated;
insert into r select 'dois pedidos (um por loja)', count(*) = 2 from orders_made;
insert into r select 'desconto só no pedido da loja do cupom',
  bool_and(case when store_id = (select v::uuid from ids where k='store_c')
                then discount_cents = 1000 and total_cents = 9000 and coupon_code = 'DEZ10'
                else discount_cents = 0 and total_cents = 5000 and coupon_code is null end)
  from public.orders where id in (select id from orders_made);
insert into r select 'uso registrado', count(*) = 1 from public.coupon_redemptions where user_id = '00000000-0000-0000-0000-0000000000c3';

-- Mesmo cupom de novo: já usado
insert into public.cart_items (user_id, product_id, quantity) values ('00000000-0000-0000-0000-0000000000c3', (select v::uuid from ids where k='pc'), 1);
insert into r select 'cupom não vale duas vezes para a mesma pessoa', pg_temp.err($q$select public.check_coupon('DEZ10')$q$) = 'coupon_used';

-- Cancelar o pedido devolve o cupom
select public.cancel_order((select o.id from public.orders o where o.id in (select id from orders_made) and o.coupon_code = 'DEZ10'));
insert into r select 'cancelamento libera o cupom', (public.check_coupon('DEZ10')->>'discount_cents')::int = 1000;

-- Desconto fixo maior que o subtotal: sobra R$ 1,00 a pagar
create temp table o2 on commit drop as select unnest(public.place_order((select v::uuid from ids where k='addr'), null, 'MENOS200')) as id;
grant all on o2 to authenticated;
insert into r select 'desconto nunca zera o pedido', total_cents = 100 and discount_cents = 9900 from public.orders where id = (select id from o2);

-- Loja vê o uso do próprio cupom; a outra loja não
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into r select 'loja vê usos do próprio cupom', count(*) = 1 from public.coupon_redemptions;
select public.set_coupon_active((select v::uuid from ids where k='cup10'), false);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
insert into r select 'outra loja não vê usos', count(*) = 0 from public.coupon_redemptions;

-- Cupom desligado não vale
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
insert into r select 'cupom desligado não vale', pg_temp.err($q$select public.check_coupon('DEZ10')$q$) = 'coupon_invalid';

-- Pedido não aceita total inconsistente
reset role;
insert into r select 'comissão de indicação sobre o total com desconto',
  bool_or(base_cents = 9000) and bool_or(base_cents = 5000) from public.affiliate_commissions where order_id in (select id from orders_made);
insert into r select 'total precisa bater com o desconto',
  pg_temp.err(format('update public.orders set discount_cents = 1 where id = %L', (select id from o2))) like '%orders_total_check%';

-- Anônimo
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r select 'anônimo não consulta cupom', pg_temp.err($q$select public.check_coupon('DEZ10')$q$) like '%permission denied%';
insert into r select 'anônimo não lê cupons', pg_temp.err('select count(*) from public.coupons') like '%permission denied%' or
  (select count(*) from public.coupons) = 0;
reset role;

select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where ok is not true) as falhas from r;
rollback;
