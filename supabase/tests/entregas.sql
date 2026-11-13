-- Teste das entregas (envio com rastreio, linha do tempo, confirmação e entrega automática). Transação + rollback.
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000e1','vend-entrega@teste.zexi','{"full_name":"Vendedor"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000e2','comp-entrega@teste.zexi','{"full_name":"Compradora"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000e3','outro-entrega@teste.zexi','{"full_name":"Outro"}','authenticated','authenticated');
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
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
insert into ids values ('store', public.create_store('Loja Entrega', 'loja-entrega-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store'), 'Mochila', 15000, 5, 'active');
insert into ids select 'p', id from public.products where title = 'Mochila';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
insert into public.addresses (user_id, recipient, cep, street, number, district, city, state)
  values ('00000000-0000-0000-0000-0000000000e2','Ana','01001000','Praça da Sé','1','Sé','São Paulo','SP');
insert into public.cart_items (user_id, product_id, quantity) values ('00000000-0000-0000-0000-0000000000e2', (select v::uuid from ids where k='p'), 1);
insert into ids select 'o', (public.checkout((select id from public.addresses where user_id = '00000000-0000-0000-0000-0000000000e2')))[1];
insert into r select 'pedido novo tem evento "created"', count(*) = 1 from public.order_events where order_id = (select v::uuid from ids where k='o') and kind = 'created';

-- Ainda não pago: não envia
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
insert into r select 'pedido aguardando pagamento não pode ser enviado',
  pg_temp.err(format('select public.ship_order(%L, %L, %L)', (select v from ids where k='o'), 'correios', 'AA123456789BR')) = 'order_not_shippable';

-- Pagamento confirmado (simulado direto no banco, como faz o aviso assinado)
reset role;
update public.orders set status = 'paid' where id = (select v::uuid from ids where k='o');
set local role authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
insert into r select 'outra pessoa não envia pedido alheio',
  pg_temp.err(format('select public.ship_order(%L, %L, %L)', (select v from ids where k='o'), 'correios', 'AA123456789BR')) = 'order_not_found';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
insert into r select 'comprador não marca como enviado',
  pg_temp.err(format('select public.ship_order(%L, %L, %L)', (select v from ids where k='o'), 'correios', 'AA123456789BR')) = 'order_not_found';
insert into r select 'comprador não confirma antes do envio',
  pg_temp.err(format('select public.confirm_delivery(%L)', (select v from ids where k='o'))) = 'order_not_in_transit';
insert into r select 'comprador não altera status direto',
  pg_temp.err(format('update public.orders set status = %L where id = %L', 'delivered', (select v from ids where k='o'))) like '%permission denied%'
  or (select status from public.orders where id = (select v::uuid from ids where k='o')) = 'paid';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
insert into r select 'transportadora inválida recusada',
  pg_temp.err(format('select public.ship_order(%L, %L, %L)', (select v from ids where k='o'), 'pombo', 'AA123456789BR')) = 'invalid_carrier';
insert into r select 'código de rastreio inválido recusado',
  pg_temp.err(format('select public.ship_order(%L, %L, %L)', (select v from ids where k='o'), 'correios', 'x;drop')) = 'invalid_tracking_code';
select public.ship_order((select v::uuid from ids where k='o'), 'correios', 'aa 123 456 789 br');
insert into r select 'loja envia: status, transportadora, código normalizado e data',
  status = 'shipped' and carrier = 'correios' and tracking_code = 'AA123456789BR' and shipped_at is not null
  from public.orders where id = (select v::uuid from ids where k='o');
select public.ship_order((select v::uuid from ids where k='o'), 'jadlog', 'JD000111222');
insert into r select 'loja corrige o código em trânsito', tracking_code = 'JD000111222' and carrier = 'jadlog' and status = 'shipped'
  from public.orders where id = (select v::uuid from ids where k='o');
insert into r select 'linha do tempo registra envio e correção',
  (select array_agg(kind order by id) from public.order_events where order_id = (select v::uuid from ids where k='o'))
  = array['created', 'paid', 'shipped', 'tracking_updated'];
insert into r select 'loja não confirma recebimento no lugar do comprador',
  pg_temp.err(format('select public.confirm_delivery(%L)', (select v from ids where k='o'))) = 'order_not_found';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
insert into r select 'outra pessoa não vê a linha do tempo', count(*) = 0 from public.order_events where order_id = (select v::uuid from ids where k='o');
insert into r select 'ninguém escreve na linha do tempo pela API',
  pg_temp.err(format('insert into public.order_events (order_id, kind) values (%L, %L)', (select v from ids where k='o'), 'delivered')) like '%permission denied%';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
insert into r select 'comprador vê a linha do tempo', count(*) = 4 from public.order_events where order_id = (select v::uuid from ids where k='o');
select public.confirm_delivery((select v::uuid from ids where k='o'));
insert into r select 'comprador confirma o recebimento', status = 'delivered' and delivery_confirmed_by = 'buyer' and delivered_at is not null
  from public.orders where id = (select v::uuid from ids where k='o');
insert into r select 'confirmação não repete',
  pg_temp.err(format('select public.confirm_delivery(%L)', (select v from ids where k='o'))) = 'order_not_in_transit';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
insert into r select 'pedido entregue não volta a ser enviado',
  pg_temp.err(format('select public.ship_order(%L, %L, %L)', (select v from ids where k='o'), 'correios', 'AA123456789BR')) = 'order_not_shippable';

reset role;
insert into r select 'e-mail de envio para o comprador na fila', exists (
  select 1 from private.outbox where kind = 'order.shipped' and recipient = 'comp-entrega@teste.zexi' and payload ->> 'tracking_code' = 'AA123456789BR');
insert into r select 'e-mail de entrega para a loja na fila', exists (
  select 1 from private.outbox where kind = 'order.delivered.seller' and recipient = 'vend-entrega@teste.zexi');

-- Entrega automática: pedido enviado há mais de 21 dias
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
insert into public.cart_items (user_id, product_id, quantity) values ('00000000-0000-0000-0000-0000000000e2', (select v::uuid from ids where k='p'), 1);
insert into ids select 'o2', (public.checkout((select id from public.addresses where user_id = '00000000-0000-0000-0000-0000000000e2')))[1];
reset role;
update public.orders set status = 'paid' where id = (select v::uuid from ids where k='o2');
update public.orders set status = 'shipped', carrier = 'correios', tracking_code = 'BB000000000BR', shipped_at = now() - interval '22 days'
  where id = (select v::uuid from ids where k='o2');
-- A função e a conferência em instruções separadas (cada instrução vê os dados do seu início)
insert into r select 'rotina de entrega automática encontra o pedido', private.auto_deliver_orders() >= 1;
insert into r select 'entrega automática depois de 21 dias', status = 'delivered' and delivery_confirmed_by = 'auto'
  from public.orders where id = (select v::uuid from ids where k='o2');
insert into r select 'rotina diária agendada', exists (select 1 from cron.job where jobname = 'zexi-auto-deliver-orders');

select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where not ok) as falhas from r;
rollback;
