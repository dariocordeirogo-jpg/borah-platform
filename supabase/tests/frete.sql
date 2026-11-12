-- Teste do frete por tabela. Roda numa transação e desfaz tudo (rollback).
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000f1','vendf@teste.livelance','{"full_name":"Vendedora F"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f2','vendg@teste.livelance','{"full_name":"Vendedor G"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f3','compf@teste.livelance','{"full_name":"Compradora"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f4','afif@teste.livelance','{"full_name":"Afiliado"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f5','opsf@teste.livelance','{"full_name":"Operações"}','authenticated','authenticated');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000f5', 'admin_ops');
create temp table r(test text, ok boolean) on commit drop;
create temp table ids(k text primary key, v text) on commit drop;
grant all on r, ids to authenticated, anon;
create function pg_temp.as_user(_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.err(_sql text) returns text language plpgsql as $$
begin execute _sql; return null; exception when others then return sqlerrm; end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- Zonas (CEP de São Paulo como origem)
insert into r select 'mesma área do CEP = local', private.shipping_zone('01001000', '01009000') = 'local';
insert into r select 'mesmo estado = estadual', private.shipping_zone('01001000', '13010000') = 'estadual';
insert into r select 'mesma região = regional', private.shipping_zone('01001000', '20040000') = 'regional';
insert into r select 'outra região = nacional', private.shipping_zone('01001000', '69900000') = 'nacional';
insert into r select 'CEP inválido não tem zona', private.shipping_zone('01001000', '00000000') is null;

set local role authenticated;
-- Loja F com CEP de origem (SP); loja G sem CEP (frete a combinar)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
insert into ids values ('store_f', public.create_store('Loja Frete', 'loja-frete-teste'));
update public.stores set origin_cep = '01001000' where id = (select v::uuid from ids where k='store_f');
insert into r select 'loja grava o CEP de origem', origin_cep = '01001000' from public.stores where id = (select v::uuid from ids where k='store_f');
insert into r select 'CEP de origem inválido recusado',
  pg_temp.err(format('update public.stores set origin_cep = %L where id = %L', '123', (select v from ids where k='store_f'))) like '%origin_cep%';
insert into public.products (store_id, title, price_cents, stock, status, weight_grams)
  values ((select v::uuid from ids where k='store_f'), 'Tênis frete', 20000, 10, 'active', 800);
insert into ids select 'pf', id from public.products where title = 'Tênis frete';
insert into r select 'peso acima de 30 kg recusado',
  pg_temp.err(format('update public.products set weight_grams = 40000 where id = %L', (select v from ids where k='pf'))) like '%weight_grams%';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
insert into ids values ('store_g', public.create_store('Loja Sem CEP', 'loja-sem-cep-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store_g'), 'Boné sem cep', 5000, 10, 'active');
insert into ids select 'pg', id from public.products where title = 'Boné sem cep';
insert into r select 'loja não altera a tabela de frete',
  pg_temp.err($q$update public.shipping_rates set price_cents = 100$q$) is null and (select min(price_cents) from public.shipping_rates) > 100;
insert into r select 'loja não usa a função da equipe',
  pg_temp.err($q$select public.admin_set_shipping_rate('pac', 'local', 300, 100, 1)$q$) = 'forbidden';

-- Compradora no Rio (regional a partir de SP): 2 tênis (1,6 kg) + 1 boné
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
insert into public.addresses (user_id, recipient, cep, street, number, district, city, state)
  values ('00000000-0000-0000-0000-0000000000f3','Compradora','20040002','Rua do Ouvidor','1','Centro','Rio de Janeiro','RJ');
insert into ids select 'addr', id from public.addresses where user_id = '00000000-0000-0000-0000-0000000000f3';
insert into public.cart_items (user_id, product_id, quantity) values
  ('00000000-0000-0000-0000-0000000000f3', (select v::uuid from ids where k='pf'), 2),
  ('00000000-0000-0000-0000-0000000000f3', (select v::uuid from ids where k='pg'), 1);
create temp table q on commit drop as select jsonb_array_elements(public.quote_cart_shipping((select v::uuid from ids where k='addr'))) as x;
grant all on q to authenticated;
insert into r select 'cotação da loja com CEP: PAC e SEDEX regionais até 2 kg',
  (x->'pac'->>'price_cents')::int = (select price_cents from public.shipping_rates where service='pac' and zone='regional' and max_grams=2000)
  and (x->'sedex'->>'days')::int = 3 and (x->>'grams')::int = 1600
  from q where x->>'store_name' = 'Loja Frete';
insert into r select 'loja sem CEP: frete a combinar', x->'pac' = 'null'::jsonb and x->'sedex' = 'null'::jsonb from q where x->>'store_name' = 'Loja Sem CEP';
insert into r select 'serviço inválido recusado',
  pg_temp.err(format('select public.place_order(%L, null, null, %L)', (select v from ids where k='addr'), 'jato')) = 'shipping_service_invalid';

-- Pedido com SEDEX e indicação
reset role;
insert into public.affiliates (user_id, code) values ('00000000-0000-0000-0000-0000000000f4', 'affrete1');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
create temp table made on commit drop as
  select unnest(public.place_order((select v::uuid from ids where k='addr'), 'affrete1', null, 'sedex')) as id;
grant all on made to authenticated;
insert into r select 'pedido da loja com CEP leva frete SEDEX no total',
  shipping_service = 'sedex' and shipping_days = 3
  and shipping_cents = (select price_cents from public.shipping_rates where service='sedex' and zone='regional' and max_grams=2000)
  and total_cents = subtotal_cents + shipping_cents
  from public.orders where id in (select id from made) and store_id = (select v::uuid from ids where k='store_f');
insert into r select 'pedido da loja sem CEP fica com frete a combinar',
  shipping_cents = 0 and shipping_service is null and total_cents = subtotal_cents
  from public.orders where id in (select id from made) and store_id = (select v::uuid from ids where k='store_g');

-- Equipe de operações ajusta um preço
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f5');
select public.admin_set_shipping_rate('pac', 'local', 300, 2190, 3);
insert into r select 'equipe ajusta preço e prazo', price_cents = 2190 and days = 3 from public.shipping_rates where service='pac' and zone='local' and max_grams=300;
insert into r select 'preço abaixo de R$ 1,00 recusado',
  pg_temp.err($q$select public.admin_set_shipping_rate('pac', 'local', 300, 50, 3)$q$) = 'invalid_rate';

reset role;
insert into r select 'comissão de indicação sem o frete',
  bool_and(base_cents = o.subtotal_cents) from public.affiliate_commissions c join public.orders o on o.id = c.order_id where c.order_id in (select id from made);
insert into r select 'ajuste auditado', count(*) = 1 from public.audit_logs where action = 'admin.shipping_rate.update' and actor_id = '00000000-0000-0000-0000-0000000000f5';
insert into r select 'taxa da Zexi sem o frete', private.fee_for(o.total_cents - o.shipping_cents) = private.fee_for(o.subtotal_cents)
  from public.orders o where o.id in (select id from made) and o.store_id = (select v::uuid from ids where k='store_f');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r select 'anônimo vê a tabela de frete', count(*) = 56 from public.shipping_rates;
insert into r select 'anônimo não cota carrinho', pg_temp.err(format('select public.quote_cart_shipping(%L)', (select v from ids where k='addr'))) like '%permission denied%';
reset role;

select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where ok is not true) as falhas from r;
rollback;
