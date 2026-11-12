-- Teste do ZEXI LIVE (Fase 7). Roda numa transação e desfaz tudo (rollback).
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000a7','vend7@teste.livelance','{"full_name":"Vendedor Sete"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b7','ana7@teste.livelance','{"full_name":"Ana Souza"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c7','outro7@teste.livelance','{"full_name":"Outro"}','authenticated','authenticated');
create temp table r(test text, ok boolean) on commit drop;
create temp table ids(k text primary key, v text) on commit drop;
grant all on r, ids to authenticated, anon;
create function pg_temp.as_user(_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.as_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', true);
$$;
create function pg_temp.err(_sql text) returns text language plpgsql as $$
begin execute _sql; return null; exception when others then return sqlerrm; end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c7');
insert into ids values ('store2', public.create_store('Outra Sete', 'outra-sete-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store2'), 'Alheio', 1000, 1, 'active');
insert into ids select 'p2', id from public.products where title = 'Alheio';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a7');
insert into ids values ('store', public.create_store('Loja Sete', 'loja-sete-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values
  ((select v::uuid from ids where k='store'), 'Bolsa', 20000, 2, 'active'),
  ((select v::uuid from ids where k='store'), 'Carteira', 8000, 1, 'active'),
  ((select v::uuid from ids where k='store'), 'Fora da live', 5000, 1, 'active');
insert into ids select 'bolsa', id from public.products where title = 'Bolsa';
insert into ids select 'carteira', id from public.products where title = 'Carteira';
insert into ids select 'fora', id from public.products where title = 'Fora da live';

insert into r select 'live sem produto recusada',
  pg_temp.err($q$select public.create_live('Live teste', null, now() + interval '1 hour', '{}')$q$) = 'products_required';
insert into r select 'produto de outra loja recusado',
  pg_temp.err(format('select public.create_live(%L, null, now() + interval %L, array[%L]::uuid[])', 'Live teste', '1 hour', (select v from ids where k='p2'))) = 'product_not_found';
insert into r select 'data no passado recusada',
  pg_temp.err(format('select public.create_live(%L, null, now() - interval %L, array[%L]::uuid[])', 'Live teste', '1 day', (select v from ids where k='bolsa'))) = 'invalid_schedule';
insert into ids values ('live', public.create_live('Bolsas de couro', 'Tudo com desconto', now() + interval '10 minutes',
  array[(select v from ids where k='bolsa'), (select v from ids where k='carteira')]::uuid[]));
insert into r select 'live programada com 2 produtos', status = 'scheduled' and (select count(*) from public.live_products where live_id = l.id) = 2
  from public.lives l where id = (select v::uuid from ids where k='live');
insert into r select 'link de reprodução precisa ser https',
  pg_temp.err(format('select public.set_live_playback(%L, %L)', (select v from ids where k='live'), 'http://x/a.m3u8')) = 'invalid_url';
select public.set_live_playback((select v::uuid from ids where k='live'), 'https://stream.exemplo.com/live/abc.m3u8');
insert into r select 'loja não altera live direto', pg_temp.err($q$update public.lives set status = 'live'$q$) like '%permission denied%';

-- Chat fechado antes de começar; outra loja não controla
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b7');
insert into r select 'chat fechado antes de começar',
  pg_temp.err(format('select public.send_live_message(%L, %L)', (select v from ids where k='live'), 'oi')) = 'live_not_live';
insert into r select 'compradora não inicia a live',
  pg_temp.err(format('select public.start_live(%L)', (select v from ids where k='live'))) = 'live_not_found';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a7');
select public.start_live((select v::uuid from ids where k='live'));
insert into r select 'live no ar', status = 'live' and started_at is not null from public.lives where id = (select v::uuid from ids where k='live');
insert into r select 'não começa duas vezes', pg_temp.err(format('select public.start_live(%L)', (select v from ids where k='live'))) = 'live_not_scheduled';
insert into r select 'destaque só de produto da live',
  pg_temp.err(format('select public.pin_live_product(%L, %L)', (select v from ids where k='live'), (select v from ids where k='fora'))) = 'product_not_in_live';
select public.pin_live_product((select v::uuid from ids where k='live'), (select v::uuid from ids where k='carteira'));
insert into r select 'produto em destaque', pinned_product_id = (select v::uuid from ids where k='carteira') from public.lives where id = (select v::uuid from ids where k='live');

-- Chat
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b7');
insert into ids values ('m1', public.send_live_message((select v::uuid from ids where k='live'), '  Quanto   custa a bolsa?  ')::text);
insert into r select 'mensagem limpa e com apelido', body = 'Quanto custa a bolsa?' and alias = 'Ana S.' from public.live_messages where id = (select v::bigint from ids where k='m1');
insert into r select 'mensagens seguidas são limitadas',
  pg_temp.err(format('select public.send_live_message(%L, %L)', (select v from ids where k='live'), 'oi de novo')) = 'too_fast';
insert into r select 'mensagem vazia recusada',
  pg_temp.err(format('select public.send_live_message(%L, %L)', (select v from ids where k='live'), '   ')) = 'invalid_message';
insert into r select 'compradora não esconde mensagem', pg_temp.err(format('select public.hide_live_message(%s)', (select v from ids where k='m1'))) = 'message_not_found';
insert into r select 'não grava mensagem direto',
  pg_temp.err($q$insert into public.live_messages (live_id, user_id, alias, body) values (gen_random_uuid(), auth.uid(), 'x', 'y')$q$) like '%permission denied%';
set local role anon;
select pg_temp.as_anon();
insert into r select 'visitante lê o chat', count(*) = 1 from public.live_messages where live_id = (select v::uuid from ids where k='live');
insert into r select 'visitante não escreve', pg_temp.err(format('select public.send_live_message(%L, %L)', (select v from ids where k='live'), 'oi')) like '%permission denied%';

-- Moderação
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a7');
select public.hide_live_message((select v::bigint from ids where k='m1'));
insert into r select 'loja ainda vê a mensagem escondida', hidden from public.live_messages where id = (select v::bigint from ids where k='m1');
set local role anon;
select pg_temp.as_anon();
insert into r select 'mensagem escondida some para o público', count(*) = 0 from public.live_messages where id = (select v::bigint from ids where k='m1');

-- Leilão relâmpago
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a7');
insert into r select 'leilão só de produto da live',
  pg_temp.err(format('select public.start_live_auction(%L, %L, 1000, 100, 5)', (select v from ids where k='live'), (select v from ids where k='fora'))) = 'product_not_in_live';
insert into ids values ('a', public.start_live_auction((select v::uuid from ids where k='live'), (select v::uuid from ids where k='bolsa'), 10000, 500, 5)::text);
insert into r select 'leilão ligado à live e reserva estoque', a.live_id = (select v::uuid from ids where k='live') and a.status = 'active' and p.stock = 1
  from public.auctions a join public.products p on p.id = a.product_id where a.id = (select v::uuid from ids where k='a');
insert into r select 'leilão vira o destaque', pinned_product_id = (select v::uuid from ids where k='bolsa') from public.lives where id = (select v::uuid from ids where k='live');
insert into r select 'um leilão por vez na live',
  pg_temp.err(format('select public.start_live_auction(%L, %L, 1000, 100, 5)', (select v from ids where k='live'), (select v from ids where k='carteira'))) = 'live_auction_running';

-- Encerrar
select public.end_live((select v::uuid from ids where k='live'));
insert into r select 'live encerrada sem destaque', status = 'ended' and pinned_product_id is null from public.lives where id = (select v::uuid from ids where k='live');
insert into r select 'não encerra duas vezes', pg_temp.err(format('select public.end_live(%L)', (select v from ids where k='live'))) = 'live_finished';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b7');
insert into r select 'chat fecha quando a live acaba',
  pg_temp.err(format('select public.send_live_message(%L, %L)', (select v from ids where k='live'), 'tchau')) = 'live_not_live';

-- Programada cancelada some do público
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a7');
insert into ids values ('live2', public.create_live('Outra live', null, now() + interval '1 day', array[(select v from ids where k='carteira')]::uuid[]));
select public.end_live((select v::uuid from ids where k='live2'));
set local role anon;
select pg_temp.as_anon();
insert into r select 'live cancelada não aparece', count(*) = 0 from public.lives where id = (select v::uuid from ids where k='live2');
insert into r select 'live encerrada continua visível', count(*) = 1 from public.lives where id = (select v::uuid from ids where k='live');

select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where not ok) as falhas from r;
rollback;
