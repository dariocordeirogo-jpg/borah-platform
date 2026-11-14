-- Teste da transmissão pelo navegador (Cloudflare Stream) nas lives. Roda numa transação e desfaz tudo (rollback).
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000aa','vend10@teste.livelance','{"full_name":"Vendedor Dez"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000ba','outro10@teste.livelance','{"full_name":"Outro"}','authenticated','authenticated');
create temp table r(test text, ok boolean) on commit drop;
create temp table ids(k text primary key, v text) on commit drop;
grant all on r, ids to authenticated, anon;
create function pg_temp.as_user(_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.err(_sql text) returns text language plpgsql as $$
begin execute _sql; return null; exception when others then return sqlerrm; end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;
insert into ids values
  ('uid', 'f256e6ea9341d51eea64c9454659e576'),
  ('play', 'https://customer-abc123xyz9.cloudflarestream.com/f256e6ea9341d51eea64c9454659e576/webRTC/play');

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000aa');
insert into ids values ('store', public.create_store('Loja Dez', 'loja-dez-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store'), 'Bolsa navegador', 9000, 3, 'active');
insert into ids select 'p', id from public.products where title = 'Bolsa navegador';
insert into ids values ('live', public.create_live('Live navegador', null, now() + interval '1 hour', array[(select v from ids where k='p')]::uuid[]));
insert into ids values ('live2', public.create_live('Live Mux', null, now() + interval '2 hour', array[(select v from ids where k='p')]::uuid[]));

-- Outro usuário não liga transmissão na live dos outros
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ba');
insert into r select 'outro não liga transmissão pelo navegador',
  pg_temp.err(format('select public.attach_browser_stream(%L, %L, %L)', (select v from ids where k='live'), (select v from ids where k='uid'), (select v from ids where k='play'))) = 'live_not_found';

-- Dono: dados fora do formato da Cloudflare são recusados
select pg_temp.as_user('00000000-0000-0000-0000-0000000000aa');
insert into r select 'id da entrada inválido recusado',
  pg_temp.err(format('select public.attach_browser_stream(%L, %L, %L)', (select v from ids where k='live'), 'x; drop', (select v from ids where k='play'))) = 'invalid_stream';
insert into r select 'link de outro domínio recusado',
  pg_temp.err(format('select public.attach_browser_stream(%L, %L, %L)', (select v from ids where k='live'), (select v from ids where k='uid'),
    'https://evil.example.com/f256e6ea9341d51eea64c9454659e576/webRTC/play')) = 'invalid_stream';
insert into r select 'link de outra entrada recusado',
  pg_temp.err(format('select public.attach_browser_stream(%L, %L, %L)', (select v from ids where k='live'), (select v from ids where k='uid'),
    'https://customer-abc123xyz9.cloudflarestream.com/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/webRTC/play')) = 'invalid_stream';
insert into r select 'endereço de envio (WHIP) não serve como reprodução',
  pg_temp.err(format('select public.attach_browser_stream(%L, %L, %L)', (select v from ids where k='live'), (select v from ids where k='uid'),
    'https://customer-abc123xyz9.cloudflarestream.com/f256e6ea9341d51eea64c9454659e576/webRTC/publish')) = 'invalid_stream';

-- Dono liga
select public.attach_browser_stream((select v::uuid from ids where k='live'), (select v from ids where k='uid'), (select v from ids where k='play'));
insert into r select 'link de reprodução vira o WHEP da Cloudflare',
  playback_url = (select v from ids where k='play') from public.lives where id = (select v::uuid from ids where k='live');
insert into r select 'referência diz que é pelo navegador',
  provider = 'cloudflare' and stream_id = (select v from ids where k='uid') and disabled_at is null
  from public.live_stream_ref((select v::uuid from ids where k='live'));
insert into r select 'segunda transmissão recusada',
  pg_temp.err(format('select public.attach_browser_stream(%L, %L, %L)', (select v from ids where k='live'), (select v from ids where k='uid'), (select v from ids where k='play'))) = 'stream_exists';
insert into r select 'Mux não entra em live que já transmite pelo navegador',
  pg_temp.err(format('select public.attach_live_stream(%L, %L, %L)', (select v from ids where k='live'), 'StreamAbc12345', 'PlayAbc12345')) = 'stream_exists';

-- Mux continua igual, agora com o serviço na referência
select public.attach_live_stream((select v::uuid from ids where k='live2'), 'StreamAbc12345', 'PlayAbc12345');
insert into r select 'referência do Mux diz mux', provider = 'mux' from public.live_stream_ref((select v::uuid from ids where k='live2'));

-- Desligar ao encerrar
select public.end_live((select v::uuid from ids where k='live'));
select public.mark_live_stream_disabled((select v::uuid from ids where k='live'));
insert into r select 'transmissão pelo navegador marcada como desligada', disabled_at is not null from public.live_stream_ref((select v::uuid from ids where k='live'));
insert into r select 'live encerrada não recebe transmissão',
  pg_temp.err(format('select public.attach_browser_stream(%L, %L, %L)', (select v from ids where k='live'), (select v from ids where k='uid'), (select v from ids where k='play'))) = 'live_finished';

-- Anônimo não chama
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r select 'anônimo não liga transmissão',
  pg_temp.err(format('select public.attach_browser_stream(%L, %L, %L)', (select v from ids where k='live2'), (select v from ids where k='uid'), (select v from ids where k='play'))) like '%permission denied%';
reset role;
insert into r select 'serviço desconhecido barrado na tabela',
  pg_temp.err('insert into private.live_streams (live_id, provider, stream_id, playback_id) values ((select v::uuid from ids where k=''live2''), ''youtube'', ''abcdefghij12'', ''abcdefghij12'')') like '%live_streams_provider_check%';

select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where not ok) as falhas from r;
rollback;
