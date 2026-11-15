-- Teste das regras da Zexi: contato oculto, reclamações e reputação verde/amarela/vermelha.
-- Roda numa transação e desfaz tudo (rollback).
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000d1','vend-rg@teste.zexi','{"full_name":"Vendedor RG"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000d2','ana-rg@teste.zexi','{"full_name":"Ana Regra"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000d3','bia-rg@teste.zexi','{"full_name":"Bia"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000d4','vend2-rg@teste.zexi','{"full_name":"Vendedora Dois"}','authenticated','authenticated');
create temp table r(test text, ok boolean) on commit drop;
create temp table ids(k text primary key, v text) on commit drop;
grant all on r, ids to authenticated, anon;
create function pg_temp.as_user(_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.err(_sql text) returns text language plpgsql as $$
begin execute _sql; return null; exception when others then return sqlerrm; end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- ===== Contato oculto =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r select 'aviso: telefone detectado', public.contact_hidden('me liga (62) 9 9999-8888');
insert into r select 'aviso: e-mail por extenso detectado', public.contact_hidden('ana arroba gmail ponto com');
insert into r select 'aviso: rede social detectada', public.contact_hidden('me chama no zap');
insert into r select 'aviso: número por extenso detectado', public.contact_hidden('nove nove nove oito oito oito sete sete');
insert into r select 'modelo, ano e medida não são contato', not public.contact_hidden('Serve na CB 500 2020, aro 17, tamanho 58?');
insert into r select 'preço não é contato', not public.contact_hidden('Sai por R$ 1.299,90 à vista');
set local role authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
insert into ids values ('store', public.create_store('Loja RG', 'loja-rg-teste'));
insert into public.products (store_id, title, description, price_cents, stock, status) values
  ((select v::uuid from ids where k='store'), 'Capacete RG chama no whatsapp', 'Dúvidas: (62) 9 9999-8888 ou loja@gmail.com', 50000, 50, 'active');
insert into ids select 'p', id from public.products where store_id = (select v::uuid from ids where k='store');
insert into r select 'título e descrição do produto com contato oculto',
  title = 'Capacete RG chama no [contato oculto]' and description = 'Dúvidas: [contato oculto] ou [contato oculto]'
  from public.products where id = (select v::uuid from ids where k='p');
update public.stores set description = 'Siga @loja.rg e www.lojarg.com.br' where id = (select v::uuid from ids where k='store');
insert into r select 'descrição da loja com contato oculto', description = 'Siga [contato oculto] e [contato oculto]'
  from public.stores where id = (select v::uuid from ids where k='store');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
insert into ids values ('q', public.ask_question((select v::uuid from ids where k='p'), 'Tem G? me manda no ana@gmail.com')::text);
insert into r select 'pergunta gravada com o contato oculto', body = 'Tem G? me manda no [contato oculto]'
  from public.product_questions where id = (select v::bigint from ids where k='q');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select public.answer_question((select v::bigint from ids where k='q'), 'Tem sim, me chama no 62999998888');
insert into r select 'resposta gravada com o contato oculto', answer = 'Tem sim, [contato oculto] no [contato oculto]'
  from public.product_questions where id = (select v::bigint from ids where k='q');

reset role;
insert into r select 'todas as tabelas de texto ocultam contato', count(*) = 11
  from pg_trigger where tgname like '%\_mask\_contact' and not tgisinternal;
update public.profiles set display_name = 'Ana insta @ana' where id = '00000000-0000-0000-0000-0000000000d2';
insert into r select 'apelido do perfil com contato oculto', display_name = 'Ana [contato oculto] [contato oculto]'
  from public.profiles where id = '00000000-0000-0000-0000-0000000000d2';

-- ===== Vendas de teste (como superusuário): pago em _paid, enviado _ship dias depois =====
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d4');
set local role authenticated;
insert into ids values ('store2', public.create_store('Loja RG Dois', 'loja-rg-dois-teste'));
reset role;
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store2'), 'Luva RG', 9000, 50, 'active');
insert into ids select 'p2', id from public.products where store_id = (select v::uuid from ids where k='store2');
create function pg_temp.sale(_store text, _buyer uuid, _paid_days_ago integer, _ship_after_days integer) returns uuid
language plpgsql as $$
declare _id uuid; _pid uuid := (select v::uuid from ids where k = case when _store = 'store' then 'p' else 'p2' end);
  _paid timestamptz := now() - make_interval(days => _paid_days_ago);
  _ship timestamptz := case when _ship_after_days is null then null else _paid + make_interval(days => _ship_after_days) end;
begin
  insert into public.orders (buyer_id, store_id, status, subtotal_cents, shipping_cents, total_cents, shipping_address, shipping_days, created_at, shipped_at, delivered_at)
  values (_buyer, (select v::uuid from ids where k=_store), case when _ship is null then 'paid' else 'delivered' end::public.order_status,
    9000, 0, 9000, '{}'::jsonb, 5, _paid, _ship, _ship + interval '2 days')
  returning id into _id;
  insert into public.order_items (order_id, product_id, title, unit_price_cents, quantity) values (_id, _pid, 'Item RG', 9000, 1);
  insert into public.payments (order_id, buyer_id, store_id, destination_account, amount_cents, fee_cents, status, paid_at)
  values (_id, _buyer, (select v::uuid from ids where k=_store), 'acct_teste', 9000, 900, 'succeeded', _paid);
  return _id;
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- Loja 1: 4 vendas no prazo → ainda sem cor (precisa de 5)
insert into ids select 's1_' || g, pg_temp.sale('store', '00000000-0000-0000-0000-0000000000d2', 10 + g, 1) from generate_series(1, 4) g;
insert into r select 'menos de 5 vendas: sem cor', sales = 4 and color is null
  from public.store_reputation(array[(select v::uuid from ids where k='store')]);
insert into ids select 's1_' || g, pg_temp.sale('store', '00000000-0000-0000-0000-0000000000d2', 10 + g, 1) from generate_series(5, 10) g;
insert into r select '10 vendas no prazo e sem reclamação: verde', sales = 10 and complaint_rate = 0 and delay_rate = 0 and cancel_rate = 0 and color = 'green'
  from public.store_reputation(array[(select v::uuid from ids where k='store')]);

-- ===== Reclamações =====
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d3');
insert into r select 'reclamar de pedido alheio recusado',
  pg_temp.err(format('select public.open_complaint(%L, %L, null)', (select v from ids where k='s1_1'), 'damaged')) = 'order_not_found';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
insert into r select 'motivo inválido recusado',
  pg_temp.err(format('select public.open_complaint(%L, %L, null)', (select v from ids where k='s1_1'), 'xyz')) = 'invalid_reason';
insert into ids values ('c1', public.open_complaint((select v::uuid from ids where k='s1_1'), 'damaged', 'Veio riscado, me liga 62 99999-8888')::text);
insert into r select 'reclamação gravada com contato oculto', reason = 'damaged' and status = 'open' and details = 'Veio riscado, [contato oculto] [contato oculto]'
  from public.order_complaints where id = (select v::bigint from ids where k='c1');
insert into r select 'uma reclamação por pedido',
  pg_temp.err(format('select public.open_complaint(%L, %L, null)', (select v from ids where k='s1_1'), 'other')) = 'complaint_exists';
insert into r select 'linha do tempo registra a reclamação', count(*) = 1 from public.order_events where order_id = (select v::uuid from ids where k='s1_1') and kind = 'complaint';
insert into r select 'ninguém grava reclamação direto',
  pg_temp.err(format('insert into public.order_complaints (order_id, store_id, buyer_id, reason) values (%L, %L, %L, %L)',
    (select v from ids where k='s1_2'), (select v from ids where k='store'), '00000000-0000-0000-0000-0000000000d2', 'other')) ~ 'permission denied|row-level security';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
insert into r select 'loja vê a reclamação', count(*) = 1 from public.order_complaints where store_id = (select v::uuid from ids where k='store');
insert into r select 'loja não encerra a reclamação',
  pg_temp.err(format('select public.resolve_complaint(%L)', (select v from ids where k='c1'))) = 'complaint_not_found';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d3');
insert into r select 'outra pessoa não vê a reclamação', count(*) = 0 from public.order_complaints where id = (select v::bigint from ids where k='c1');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r select '1 reclamação em 10 vendas (10%): amarela', complaint_rate = 0.100 and color = 'yellow'
  from public.store_reputation(array[(select v::uuid from ids where k='store')]);
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
select public.resolve_complaint((select v::bigint from ids where k='c1'));
insert into r select 'comprador encerra a reclamação', status = 'resolved' and resolved_at is not null
  from public.order_complaints where id = (select v::bigint from ids where k='c1');
select public.open_complaint((select v::uuid from ids where k='s1_2'), 'not_as_described', null);
insert into r select '2 reclamações em 10 vendas (20%, mesmo resolvidas): vermelha', complaint_rate = 0.200 and color = 'red'
  from public.store_reputation(array[(select v::uuid from ids where k='store')]);
reset role;
update public.orders set delivered_at = now() - interval '31 days' where id = (select v::uuid from ids where k='s1_3');
set local role authenticated;
insert into r select 'reclamação depois de 30 dias da entrega recusada',
  pg_temp.err(format('select public.open_complaint(%L, %L, null)', (select v from ids where k='s1_3'), 'damaged')) = 'complaint_window_closed';

-- ===== Loja 2: atrasos e cancelamentos =====
reset role;
select pg_temp.sale('store2', '00000000-0000-0000-0000-0000000000d3', 20 + g, 1) from generate_series(1, 8) g;
select pg_temp.sale('store2', '00000000-0000-0000-0000-0000000000d3', 20 + g, 5) from generate_series(9, 10) g;
set local role anon;
insert into r select '2 atrasos em 10 vendas (20%, no limite): amarela', sales = 10 and delay_rate = 0.200 and color = 'yellow'
  from public.store_reputation(array[(select v::uuid from ids where k='store2')]);
reset role;
insert into public.audit_logs (actor_id, action, entity, entity_id)
  select '00000000-0000-0000-0000-0000000000d4', 'order.refund_requested', 'order', id::text
  from public.orders where store_id = (select v::uuid from ids where k='store2') and shipped_at <= created_at + interval '1 day' limit 1;
set local role anon;
insert into r select '1 cancelamento pela loja em 10 vendas (10% > 5%): vermelha', cancel_rate = 0.100 and color = 'red'
  from public.store_reputation(array[(select v::uuid from ids where k='store2')]);
reset role;
-- Pedido pago e não despachado há mais de 3 dias conta como atraso
select pg_temp.sale('store2', '00000000-0000-0000-0000-0000000000d3', 5, null);
set local role anon;
insert into r select 'pago e não enviado depois do prazo conta como atraso', sales = 11 and delay_rate = 0.273
  from public.store_reputation(array[(select v::uuid from ids where k='store2')]);
insert into r select 'visitante não lê reclamações', pg_temp.err('select count(*) from public.order_complaints') ~ 'permission denied'
  or (select count(*) from public.order_complaints) = 0;
insert into r select 'visitante não abre reclamação', pg_temp.err(format('select public.open_complaint(%L, %L, null)', (select v from ids where k='s1_4'), 'damaged')) like '%permission denied%';
reset role;

insert into r select 'loja avisada da reclamação por e-mail (fila)', count(*) = 2 from private.outbox where kind = 'complaint.opened' and recipient = 'vend-rg@teste.zexi';

select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where not coalesce(ok, false)) as falhas from r;
rollback;
