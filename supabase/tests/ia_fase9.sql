-- Teste da IA (Fase 9): cota diária e triagem. Roda numa transação e desfaz tudo (rollback).
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000a9','vend9@teste.livelance','{"full_name":"Vendedor"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b9','ana9@teste.livelance','{"full_name":"Ana"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000d9','mod9@teste.livelance','{"full_name":"Mod"}','authenticated','authenticated');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000d9', 'moderator');
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
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b9');
insert into r select 'primeira busca com IA liberada', public.ai_take_quota('search');
select public.ai_take_quota('search') from generate_series(1, 59);
insert into r select 'cota de buscas acaba em 60 por dia', not public.ai_take_quota('search');
insert into r select 'cota de descrição é separada', public.ai_take_quota('description');
insert into r select 'recurso desconhecido recusado', pg_temp.err($q$select public.ai_take_quota('outro')$q$) = 'invalid_feature';
insert into r select 'triagem só para a equipe', pg_temp.err($q$select public.ai_take_quota('triage')$q$) = 'forbidden';
insert into r select 'compradora não lê o uso', pg_temp.err('select count(*) from private.ai_usage') like '%permission denied%';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a9');
insert into ids values ('store', public.create_store('Loja Nove', 'loja-nove-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store'), 'Perfume', 9000, 1, 'active');
insert into ids select 'p', id from public.products where title = 'Perfume';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b9');
insert into ids values ('rep', public.report_content('product', (select v from ids where k='p'), 'falsificado')::text);
insert into r select 'compradora não grava triagem',
  pg_temp.err(format('select public.admin_set_report_triage(%L, %L)', (select v from ids where k='rep'), '{"severity":"alta","recommendation":"agir","rationale":"x"}')) = 'forbidden';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000d9');
insert into r select 'moderadora usa a cota de triagem', public.ai_take_quota('triage');
insert into r select 'triagem com valores fora da lista recusada',
  pg_temp.err(format('select public.admin_set_report_triage(%L, %L)', (select v from ids where k='rep'), '{"severity":"gravissima","recommendation":"agir","rationale":"x"}')) = 'invalid_triage';
select public.admin_set_report_triage((select v::uuid from ids where k='rep'),
  '{"severity":"alta","recommendation":"agir","rationale":"Marca famosa por preço muito abaixo do mercado.","extra":"ignorado"}');
insert into r select 'triagem guardada só com os campos conhecidos',
  ai_triage->>'severity' = 'alta' and ai_triage->>'recommendation' = 'agir' and not (ai_triage ? 'extra') and ai_triage ? 'at'
  from public.reports where id = (select v::uuid from ids where k='rep');

reset role;
update public.feature_flags set enabled = false where key = 'ai';
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b9');
insert into r select 'flag desligada bloqueia a IA', not public.ai_take_quota('description');

select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where not ok) as falhas from r;
rollback;
