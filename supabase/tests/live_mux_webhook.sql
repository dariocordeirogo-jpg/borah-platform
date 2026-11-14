-- Teste dos avisos do Mux e do encerramento automático de live abandonada. Transação + rollback.
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000f7','vend-mx@teste.zexi','{"full_name":"Vendedor MX"}','authenticated','authenticated');
create temp table r(test text, ok boolean) on commit drop;
create temp table ids(k text primary key, v text) on commit drop;
grant all on r, ids to authenticated, anon;
create function pg_temp.as_user(_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.err(_sql text) returns text language plpgsql as $$
begin execute _sql; return null; exception when others then return sqlerrm; end $$;
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'mux_webhook_secret') then
    perform vault.create_secret('segredo-de-teste-do-webhook-mux-0123456789', 'mux_webhook_secret');
  end if;
end $$;
create function pg_temp.sig(_payload text) returns text language sql as $$
  select 't=' || extract(epoch from now())::bigint || ',v1=' || encode(extensions.hmac(
    convert_to(extract(epoch from now())::bigint || '.' || _payload, 'UTF8'),
    convert_to((select decrypted_secret from vault.decrypted_secrets where name = 'mux_webhook_secret'), 'UTF8'), 'sha256'), 'hex')
$$;
create function pg_temp.evt(_id text, _type text, _stream text) returns jsonb language sql as $$
  select public.mux_ingest_event(p, pg_temp.sig(p))
  from (select json_build_object('id', _id, 'type', _type, 'data', json_build_object('id', _stream))::text p) x
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f7');
insert into ids values ('store', public.create_store('Loja MX', 'loja-mx-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store'), 'Produto MX', 1000, 1, 'active');
insert into ids values ('live', public.create_live('Live MX', null, now() + interval '1 minute',
  array[(select id from public.products where title = 'Produto MX')]::uuid[]));
select public.attach_live_stream((select v::uuid from ids where k='live'), 'StreamMxTeste0001', 'PlaybackMxTeste01');
reset role;

insert into r select 'assinatura errada recusada',
  pg_temp.err($q$select public.mux_ingest_event('{"id":"x","type":"video.live_stream.active"}', 't=1,v1=abc')$q$) = 'invalid_signature';
insert into r select 'sinal chegando marcado (live programada)', pg_temp.evt('ev1', 'video.live_stream.active', 'StreamMxTeste0001') ->> 'result' = 'signal_active';
insert into r select 'aviso repetido ignorado', (pg_temp.evt('ev1', 'video.live_stream.active', 'StreamMxTeste0001') ->> 'duplicate')::boolean;
insert into r select 'transmissão desconhecida ignorada', pg_temp.evt('ev2', 'video.live_stream.active', 'OutraStream00001') ->> 'result' = 'unknown_stream';
insert into r select 'live mostra sinal ativo', stream_signal = 'active' from public.lives where id = (select v::uuid from ids where k='live');

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f7');
select public.start_live((select v::uuid from ids where k='live'));
reset role;
insert into r select 'sinal caiu marcado', pg_temp.evt('ev3', 'video.live_stream.idle', 'StreamMxTeste0001') ->> 'result' = 'signal_idle';
insert into r select 'sinal caiu há pouco: live continua', private.close_abandoned_lives() = 0
  and (select status from public.lives where id = (select v::uuid from ids where k='live')) = 'live';
update public.lives set stream_signal_at = now() - interval '31 minutes' where id = (select v::uuid from ids where k='live');
insert into ids select 'closed', private.close_abandoned_lives()::text;
insert into r select 'sem sinal há 30 min: live encerrada sozinha', (select v::int from ids where k='closed') >= 1
  and (select status from public.lives where id = (select v::uuid from ids where k='live')) = 'ended';
insert into r select 'encerramento automático auditado', exists (select 1 from public.audit_logs where action = 'live.auto_end' and entity_id = (select v from ids where k='live'));

insert into r select 'aviso de live encerrada pede para desligar a chave',
  (select e ->> 'action' = 'disable' and e ->> 'stream_id' = 'StreamMxTeste0001' from pg_temp.evt('ev4', 'video.live_stream.active', 'StreamMxTeste0001') e);
insert into r select 'servidor confirma a chave desligada', pg_temp.evt('zexi_ev5', 'zexi.stream_disabled', 'StreamMxTeste0001') ->> 'result' = 'marked_disabled';
insert into r select 'chave desligada não pede de novo', pg_temp.evt('ev6', 'video.live_stream.idle', 'StreamMxTeste0001') ->> 'action' is null;

-- Programada e esquecida há mais de 24 h vira cancelada
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f7');
insert into ids values ('live2', public.create_live('Live MX 2', null, now() + interval '1 minute',
  array[(select id from public.products where title = 'Produto MX')]::uuid[]));
reset role;
update public.lives set scheduled_at = now() - interval '25 hours' where id = (select v::uuid from ids where k='live2');
select private.close_abandoned_lives();
insert into r select 'programada esquecida vira cancelada', status = 'cancelled' from public.lives where id = (select v::uuid from ids where k='live2');

set local role anon;
insert into r select 'ninguém lê os avisos do Mux', pg_temp.err('select count(*) from private.mux_events') like '%permission denied%';
reset role;
select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where ok is not true) as falhas from r;
rollback;
