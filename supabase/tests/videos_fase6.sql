-- Teste dos vídeos (Fase 6). Roda numa transação e desfaz tudo (rollback).
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000a6','vend6@teste.livelance','{"full_name":"Vendedor Seis"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b6','ana6@teste.livelance','{"full_name":"Ana"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c6','outro6@teste.livelance','{"full_name":"Outro Vendedor"}','authenticated','authenticated');
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
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c6');
insert into ids values ('store2', public.create_store('Outra Loja', 'outra-loja-seis'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store2'), 'Produto alheio', 5000, 1, 'active');
insert into ids select 'p2', id from public.products where title = 'Produto alheio';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
insert into ids values ('store', public.create_store('Loja Seis', 'loja-seis-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store'), 'Tênis', 30000, 3, 'active');
insert into ids select 'p', id from public.products where title = 'Tênis';
insert into ids values ('path', (select v from ids where k='store') || '/' || gen_random_uuid() || '.mp4');

-- Arquivo "enviado" (simulado direto no catálogo do Storage)
reset role;
insert into storage.objects (bucket_id, name, owner) values ('product-videos', (select v from ids where k='path'), '00000000-0000-0000-0000-0000000000a6');
insert into storage.objects (bucket_id, name, owner) values ('product-videos', (select v from ids where k='store2') || '/11111111-1111-1111-1111-111111111111.mp4', '00000000-0000-0000-0000-0000000000c6');

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
insert into r select 'produto de outra loja recusado',
  pg_temp.err(format('select public.create_video(%L, %L)', (select v from ids where k='p2'), (select v from ids where k='path'))) = 'product_not_found';
insert into r select 'arquivo na pasta de outra loja recusado',
  pg_temp.err(format('select public.create_video(%L, %L)', (select v from ids where k='p'), (select v from ids where k='store2') || '/11111111-1111-1111-1111-111111111111.mp4')) = 'invalid_path';
insert into r select 'arquivo que não existe recusado',
  pg_temp.err(format('select public.create_video(%L, %L)', (select v from ids where k='p'), (select v from ids where k='store') || '/22222222-2222-2222-2222-222222222222.mp4')) = 'file_not_found';
insert into r select 'caminho fora do padrão recusado',
  pg_temp.err(format('select public.create_video(%L, %L)', (select v from ids where k='p'), (select v from ids where k='store') || '/../x.mp4')) = 'invalid_path';
insert into ids values ('v', public.create_video((select v::uuid from ids where k='p'), (select v from ids where k='path'), '  Tênis novo, confira!  '));
insert into r select 'vídeo publicado com legenda limpa', status = 'published' and caption = 'Tênis novo, confira!' from public.videos where id = (select v::uuid from ids where k='v');
insert into r select 'loja não grava vídeo direto', pg_temp.err($q$update public.videos set likes_count = 999$q$) like '%permission denied%';

-- Visitante vê, conta visualização, não curte
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r select 'visitante vê o vídeo', count(*) = 1 from public.videos where id = (select v::uuid from ids where k='v');
select public.register_video_view((select v::uuid from ids where k='v'));
select public.register_video_view((select v::uuid from ids where k='v'));
insert into r select 'visualizações contadas', views_count = 2 from public.videos where id = (select v::uuid from ids where k='v');
insert into r select 'visitante não curte', pg_temp.err(format('select public.toggle_video_like(%L)', (select v from ids where k='v'))) like '%permission denied%';

-- Ana curte e descurte
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b6');
insert into r select 'curtir', (public.toggle_video_like((select v::uuid from ids where k='v')))->>'likes' = '1';
insert into r select 'curtida registrada para ela', count(*) = 1 from public.video_likes;
insert into r select 'descurtir', (public.toggle_video_like((select v::uuid from ids where k='v')))->>'liked' = 'false';
insert into r select 'contador volta a zero', likes_count = 0 from public.videos where id = (select v::uuid from ids where k='v');
insert into r select 'compradora não remove vídeo alheio',
  pg_temp.err(format('select public.remove_video(%L)', (select v from ids where k='v'))) = 'video_not_found';

-- Produto pausado some do feed (mas a loja ainda vê)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
update public.products set status = 'paused' where id = (select v::uuid from ids where k='p');
insert into r select 'loja vê vídeo de produto pausado', count(*) = 1 from public.videos;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r select 'produto pausado some do feed', count(*) = 0 from public.videos where id = (select v::uuid from ids where k='v');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
update public.products set status = 'active' where id = (select v::uuid from ids where k='p');

-- Loja remove o vídeo
insert into r select 'remover devolve o caminho do arquivo', public.remove_video((select v::uuid from ids where k='v')) = (select v from ids where k='path');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r select 'vídeo removido some do feed', count(*) = 0 from public.videos where id = (select v::uuid from ids where k='v');
reset role;
insert into r select 'auditoria de criação e remoção', count(*) = 2 from public.audit_logs where entity = 'video' and entity_id = (select v from ids where k='v');

select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where not ok) as falhas from r;
rollback;
