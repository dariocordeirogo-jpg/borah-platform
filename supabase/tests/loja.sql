-- Teste da página da loja personalizada. Roda numa transação e desfaz tudo (rollback).
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000b1','vend-lj@teste.zexi','{"full_name":"Vendedor LJ"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b2','outra-lj@teste.zexi','{"full_name":"Outra LJ"}','authenticated','authenticated');
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
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
insert into ids values ('store2', public.create_store('Outra LJ', 'outra-lj-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store2'), 'Produto alheio LJ', 1000, 1, 'active');
insert into ids select 'p_alheio', id from public.products where title = 'Produto alheio LJ';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into ids values ('store', public.create_store('Loja LJ', 'loja-lj-teste'));
insert into public.products (store_id, title, price_cents, stock, status)
  select (select v::uuid from ids where k='store'), 'Produto LJ ' || g, 1000 + g, 1, 'active' from generate_series(1, 13) g;
insert into ids select 'p1', id from public.products where title = 'Produto LJ 1';

-- Aparência
update public.stores set theme = 'azul', tagline = 'Peças originais, chama no zap', logo_path = (select v from ids where k='store') || '/logo.png'
  where id = (select v::uuid from ids where k='store');
insert into r select 'loja muda cor, frase e logo (contato da frase oculto)', theme = 'azul' and tagline = 'Peças originais, chama no [contato oculto]'
  and logo_path like '%/logo.png' from public.stores where id = (select v::uuid from ids where k='store');
insert into r select 'cor fora da lista recusada',
  pg_temp.err(format('update public.stores set theme = %L where id = %L', 'neon', (select v from ids where k='store'))) is not null;
insert into r select 'logo de outra pasta recusado',
  pg_temp.err(format('update public.stores set logo_path = %L where id = %L', (select v from ids where k='store2') || '/x.png', (select v from ids where k='store'))) is not null;

-- Banners
insert into public.store_banners (store_id, image_path, title, product_id, position)
  values ((select v::uuid from ids where k='store'), (select v from ids where k='store') || '/b1.png', 'Liquidação! www.minhaloja.com', (select v::uuid from ids where k='p1'), 0);
insert into r select 'banner gravado com contato oculto', title = 'Liquidação! [contato oculto]' from public.store_banners where store_id = (select v::uuid from ids where k='store');
insert into r select 'banner não leva a produto de outra loja',
  pg_temp.err(format('insert into public.store_banners (store_id, image_path, product_id) values (%L, %L, %L)',
    (select v from ids where k='store'), (select v from ids where k='store') || '/b2.png', (select v from ids where k='p_alheio'))) = 'product_not_found';
insert into r select 'banner com imagem de outra pasta recusado',
  pg_temp.err(format('insert into public.store_banners (store_id, image_path) values (%L, %L)',
    (select v from ids where k='store'), (select v from ids where k='store2') || '/b.png')) is not null;
insert into r select 'loja não cria banner na loja alheia',
  pg_temp.err(format('insert into public.store_banners (store_id, image_path) values (%L, %L)',
    (select v from ids where k='store2'), (select v from ids where k='store2') || '/b.png')) ~ 'row-level security';
insert into public.store_banners (store_id, image_path, position)
  select (select v::uuid from ids where k='store'), (select v from ids where k='store') || '/b' || g || '.png', g from generate_series(2, 5) g;
insert into r select 'no máximo 5 banners',
  pg_temp.err(format('insert into public.store_banners (store_id, image_path) values (%L, %L)',
    (select v from ids where k='store'), (select v from ids where k='store') || '/b6.png')) = 'too_many_banners';

-- Destaques
insert into public.store_featured (store_id, product_id, position)
  select (select v::uuid from ids where k='store'), id, row_number() over (order by title) from public.products
  where store_id = (select v::uuid from ids where k='store') order by title limit 12;
insert into r select 'loja escolhe 12 destaques', count(*) = 12 from public.store_featured where store_id = (select v::uuid from ids where k='store');
insert into r select 'no máximo 12 destaques',
  pg_temp.err(format('insert into public.store_featured (store_id, product_id) select %L, id from public.products where title = %L',
    (select v from ids where k='store'), 'Produto LJ 9')) is not null;
insert into r select 'destaque não pode ser produto de outra loja',
  pg_temp.err(format('delete from public.store_featured where store_id = %L and position = 1; insert into public.store_featured (store_id, product_id) values (%L, %L)',
    (select v from ids where k='store'), (select v from ids where k='store'), (select v from ids where k='p_alheio'))) = 'product_not_found';

-- Outra loja não mexe
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
update public.stores set theme = 'rosa' where id = (select v::uuid from ids where k='store');
delete from public.store_banners where store_id = (select v::uuid from ids where k='store');
reset role;
insert into r select 'outra loja não muda a aparência', theme = 'azul' from public.stores where id = (select v::uuid from ids where k='store');
insert into r select 'outra loja não apaga banners', count(*) = 5 from public.store_banners where store_id = (select v::uuid from ids where k='store');

-- Visitante vê
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r select 'visitante vê banners e destaques', (select count(*) from public.store_banners where store_id = (select v::uuid from ids where k='store')) = 5
  and (select count(*) from public.store_featured where store_id = (select v::uuid from ids where k='store')) = 12;
insert into r select 'visitante não cria banner',
  pg_temp.err(format('insert into public.store_banners (store_id, image_path) values (%L, %L)',
    (select v from ids where k='store'), (select v from ids where k='store') || '/x.png')) ~ 'permission denied|row-level security';
reset role;
insert into r select 'bucket de imagens da loja é público e só aceita imagem', public and allowed_mime_types @> array['image/png'] from storage.buckets where id = 'store-media';

select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where not coalesce(ok, false)) as falhas from r;
rollback;
