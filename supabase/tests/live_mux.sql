-- Teste da transmissão Mux nas lives. Roda numa transação e desfaz tudo (rollback).
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000a9','vend9@teste.livelance','{"full_name":"Vendedor Nove"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b9','outro9@teste.livelance','{"full_name":"Outro"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000d9','mod9@teste.livelance','{"full_name":"Moderadora"}','authenticated','authenticated');
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
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a9');
insert into ids values ('store', public.create_store('Loja Nove', 'loja-nove-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store'), 'Tênis ao vivo', 9000, 3, 'active');
insert into ids select 'p', id from public.products where title = 'Tênis ao vivo';
insert into ids values ('live', public.create_live('Live Mux', null, now() + interval '1 hour', array[(select v from ids where k='p')]::uuid[]));

-- Outro usuário não liga nem enxerga a transmissão
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b9');
insert into r select 'outro não liga transmissão',
  pg_temp.err(format('select public.attach_live_stream(%L, %L, %L)', (select v from ids where k='live'), 'StreamAbc12345', 'PlayAbc12345')) = 'live_not_found';
insert into r select 'outro não vê a referência',
  pg_temp.err(format('select * from public.live_stream_ref(%L)', (select v from ids where k='live'))) = 'live_not_found';

-- Dono liga
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a9');
insert into r select 'id inválido recusado',
  pg_temp.err(format('select public.attach_live_stream(%L, %L, %L)', (select v from ids where k='live'), 'x; drop', 'PlayAbc12345')) = 'invalid_stream';
select public.attach_live_stream((select v::uuid from ids where k='live'), 'StreamAbc12345', 'PlayAbc12345');
insert into r select 'link de reprodução vira o do Mux',
  playback_url = 'https://stream.mux.com/PlayAbc12345.m3u8' from public.lives where id = (select v::uuid from ids where k='live');
insert into r select 'segunda transmissão recusada',
  pg_temp.err(format('select public.attach_live_stream(%L, %L, %L)', (select v from ids where k='live'), 'StreamXyz12345', 'PlayXyz12345')) = 'stream_exists';
insert into r select 'dono vê a referência', stream_id = 'StreamAbc12345' and disabled_at is null from public.live_stream_ref((select v::uuid from ids where k='live'));
insert into r select 'tabela privada fora do alcance da API',
  pg_temp.err('select * from private.live_streams') like '%permission denied%';

-- Anônimo não chama as funções
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r select 'anônimo não lê a referência',
  pg_temp.err(format('select * from public.live_stream_ref(%L)', (select v from ids where k='live'))) like '%permission denied%';
set local role authenticated;

-- Moderação enxerga e marca como desligada
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d9');
insert into r select 'moderação vê a referência', count(*) = 1 from public.live_stream_ref((select v::uuid from ids where k='live'));
select public.admin_end_live((select v::uuid from ids where k='live'), 'Conteúdo proibido');
select public.mark_live_stream_disabled((select v::uuid from ids where k='live'));
insert into r select 'transmissão marcada como desligada', disabled_at is not null from public.live_stream_ref((select v::uuid from ids where k='live'));

-- Live encerrada não aceita nova transmissão
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a9');
insert into r select 'live encerrada não recebe transmissão',
  pg_temp.err(format('select public.attach_live_stream(%L, %L, %L)', (select v from ids where k='live'), 'StreamNew12345', 'PlayNew12345')) = 'live_finished';
reset role;
insert into r select 'ligação auditada', count(*) = 1 from public.audit_logs where action = 'live.stream.attach' and entity_id = (select v from ids where k='live');

select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where not ok) as falhas from r;
rollback;
