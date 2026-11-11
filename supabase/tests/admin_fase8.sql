-- Teste do Admin (Fase 8). Roda numa transação e desfaz tudo (rollback).
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000a8','vend8@teste.livelance','{"full_name":"Vendedor Oito"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b8','ana8@teste.livelance','{"full_name":"Ana"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000d8','mod8@teste.livelance','{"full_name":"Moderadora"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000e8','fin8@teste.livelance','{"full_name":"Financeiro"}','authenticated','authenticated');
insert into public.user_roles (user_id, role) values
 ('00000000-0000-0000-0000-0000000000d8', 'moderator'),
 ('00000000-0000-0000-0000-0000000000e8', 'admin_finance');
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
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a8');
insert into ids values ('store', public.create_store('Loja Oito', 'loja-oito-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store'), 'Relógio suspeito', 9000, 1, 'active');
insert into ids select 'p', id from public.products where title = 'Relógio suspeito';

-- Compradora denuncia
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b8');
insert into r select 'compradora não abre o painel', pg_temp.err('select public.admin_overview()') = 'forbidden';
insert into ids values ('rep', public.report_content('product', (select v from ids where k='p'), 'falsificado', 'Parece réplica')::text);
insert into r select 'denúncia duplicada recusada',
  pg_temp.err(format('select public.report_content(%L, %L, %L)', 'product', (select v from ids where k='p'), 'fraude')) = 'already_reported';
insert into r select 'item inexistente recusado',
  pg_temp.err(format('select public.report_content(%L, %L, %L)', 'video', gen_random_uuid(), 'spam')) = 'target_not_found';
insert into r select 'motivo fora da lista recusado',
  pg_temp.err(format('select public.report_content(%L, %L, %L)', 'store', (select v from ids where k='store'), 'nao gostei')) like '%reports_reason_check%';
insert into r select 'quem denunciou vê a própria denúncia', count(*) = 1 from public.reports;
insert into r select 'compradora não bloqueia produto',
  pg_temp.err(format('select public.admin_block_product(%L, %L)', (select v from ids where k='p'), 'teste')) = 'forbidden';

-- Vendedor não vê denúncias sobre ele
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a8');
insert into r select 'vendedor não vê a denúncia', count(*) = 0 from public.reports;

-- Moderadora
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d8');
insert into r select 'moderadora vê a fila de denúncias', count(*) = 1 from public.reports where status = 'open';
insert into r select 'painel com números', (public.admin_overview()->>'reports_open')::int >= 1;
insert into r select 'bloqueio exige motivo',
  pg_temp.err(format('select public.admin_block_product(%L, %L)', (select v from ids where k='p'), ' ')) = 'reason_required';
select public.admin_block_product((select v::uuid from ids where k='p'), 'Réplica de marca');
insert into r select 'produto bloqueado sai de venda', status = 'paused' and blocked_reason = 'Réplica de marca' from public.products where id = (select v::uuid from ids where k='p');
select public.admin_resolve_report((select v::uuid from ids where k='rep'), 'actioned', 'Produto bloqueado');
insert into r select 'denúncia resolvida', status = 'actioned' and resolved_by = '00000000-0000-0000-0000-0000000000d8' from public.reports where id = (select v::uuid from ids where k='rep');
insert into r select 'moderadora não suspende loja',
  pg_temp.err(format('select public.admin_set_store_active(%L, false, %L)', (select v from ids where k='store'), 'golpe')) = 'forbidden';

-- Vendedor não reativa produto bloqueado
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a8');
insert into r select 'vendedor não reativa produto bloqueado',
  pg_temp.err(format('update public.products set status = %L where id = %L', 'active', (select v from ids where k='p'))) = 'product_blocked';
insert into r select 'vendedor não apaga o motivo do bloqueio',
  pg_temp.err(format('update public.products set blocked_reason = null where id = %L', (select v from ids where k='p'))) like '%permission denied%';

-- Desbloqueio libera
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d8');
select public.admin_unblock_product((select v::uuid from ids where k='p'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a8');
update public.products set status = 'active' where id = (select v::uuid from ids where k='p');
insert into r select 'depois do desbloqueio o vendedor reativa', status = 'active' from public.products where id = (select v::uuid from ids where k='p');

-- Financeiro: vê números e pedidos, não modera
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e8');
insert into r select 'financeiro vê o painel', public.admin_overview() ? 'gmv_cents';
insert into r select 'financeiro não modera',
  pg_temp.err(format('select public.admin_block_product(%L, %L)', (select v from ids where k='p'), 'teste')) = 'forbidden';
insert into r select 'financeiro não vê denúncias', count(*) = 0 from public.reports;

-- Admin de operações suspende a loja: some do público
reset role;
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000d8', 'admin_ops');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a8');
insert into ids values ('live', public.create_live('Live da loja', null, now() + interval '1 hour', array[(select v from ids where k='p')]::uuid[]));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d8');
insert into r select 'suspender exige motivo',
  pg_temp.err(format('select public.admin_set_store_active(%L, false, null)', (select v from ids where k='store'))) = 'reason_required';
select public.admin_set_store_active((select v::uuid from ids where k='store'), false, 'Golpe confirmado');
insert into r select 'equipe ainda vê a loja suspensa', count(*) = 1 from public.stores where id = (select v::uuid from ids where k='store');
insert into r select 'lives da loja suspensa canceladas', status = 'cancelled' from public.lives where id = (select v::uuid from ids where k='live');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r select 'loja suspensa some do público', count(*) = 0 from public.stores where id = (select v::uuid from ids where k='store');
insert into r select 'produtos da loja suspensa somem', count(*) = 0 from public.products where id = (select v::uuid from ids where k='p');
reset role;
insert into r select 'ações da equipe auditadas com motivo',
  count(*) = 4 from public.audit_logs where actor_id = '00000000-0000-0000-0000-0000000000d8' and action like 'admin.%';
insert into r select 'suspensão registra o motivo',
  data->>'reason' = 'Golpe confirmado' from public.audit_logs where action = 'admin.store.suspend' and entity_id = (select v from ids where k='store');

select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where not ok) as falhas from r;
rollback;
