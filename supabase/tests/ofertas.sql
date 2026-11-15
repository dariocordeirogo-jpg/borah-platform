-- Teste das ofertas e das ofertas relâmpago. Roda numa transação e desfaz tudo (rollback).
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000c1','vend-of@teste.zexi','{"full_name":"Vendedor OF"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c2','outra-of@teste.zexi','{"full_name":"Outra Loja"}','authenticated','authenticated');
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
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
insert into ids values ('store2', public.create_store('Outra OF', 'outra-of-teste'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into ids values ('store', public.create_store('Loja OF', 'loja-of-teste'));
insert into public.products (store_id, title, price_cents, compare_at_cents, stock, status) values
  ((select v::uuid from ids where k='store'), 'Fone OF', 10000, null, 5, 'active'),
  ((select v::uuid from ids where k='store'), 'Caixa OF', 8000, 10000, 5, 'active'),
  ((select v::uuid from ids where k='store'), 'Rascunho OF', 5000, null, 5, 'draft');
insert into ids select 'fone', id from public.products where title = 'Fone OF';
insert into ids select 'caixa', id from public.products where title = 'Caixa OF';
insert into ids select 'rasc', id from public.products where title = 'Rascunho OF';

insert into r select 'desconto calculado pelo banco (de 100 por 80 = 20%)', discount_pct = 20 from public.products where id = (select v::uuid from ids where k='caixa');
insert into r select 'sem preço "de" não há desconto', discount_pct is null from public.products where id = (select v::uuid from ids where k='fone');

-- Validações
insert into r select 'desconto menor que 5% recusado',
  pg_temp.err(format('select public.create_flash_deal(%L, 9600, null, 2)', (select v from ids where k='fone'))) = 'invalid_deal_price';
insert into r select 'mais de 24 horas recusado',
  pg_temp.err(format('select public.create_flash_deal(%L, 7000, null, 25)', (select v from ids where k='fone'))) = 'invalid_duration';
insert into r select 'produto em rascunho recusado',
  pg_temp.err(format('select public.create_flash_deal(%L, 3000, null, 2)', (select v from ids where k='rasc'))) = 'product_not_active';
insert into r select 'começar daqui a mais de 7 dias recusado',
  pg_temp.err(format('select public.create_flash_deal(%L, 7000, %L, 2)', (select v from ids where k='fone'), now() + interval '8 days')) = 'invalid_start';

-- Oferta que começa agora: preço troca na hora e o antigo vira o "de"
insert into ids values ('d1', public.create_flash_deal((select v::uuid from ids where k='fone'), 7000, null, 2)::text);
insert into r select 'oferta começa na hora', status = 'active' and original_price_cents = 10000 from public.flash_deals where id = (select v::bigint from ids where k='d1');
insert into r select 'preço do produto vira o da oferta (de 100 por 70)', price_cents = 7000 and compare_at_cents = 10000 and discount_pct = 30
  from public.products where id = (select v::uuid from ids where k='fone');
insert into r select 'uma oferta por produto',
  pg_temp.err(format('select public.create_flash_deal(%L, 6000, null, 2)', (select v from ids where k='fone'))) = 'deal_exists';

-- Outra loja não mexe
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
insert into r select 'outra loja não cria oferta no produto alheio',
  pg_temp.err(format('select public.create_flash_deal(%L, 5000, null, 2)', (select v from ids where k='caixa'))) = 'product_not_found';
insert into r select 'outra loja não encerra a oferta alheia',
  pg_temp.err(format('select public.cancel_flash_deal(%L)', (select v from ids where k='d1'))) = 'deal_not_found';
insert into r select 'ninguém grava oferta direto',
  pg_temp.err(format('insert into public.flash_deals (product_id, store_id, deal_price_cents, starts_at, ends_at) values (%L, %L, 1, now(), now() + interval ''1 hour'')',
    (select v from ids where k='caixa'), (select v from ids where k='store'))) ~ 'permission denied|row-level security';

-- Visitante vê a oferta ativa
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r select 'visitante vê a oferta relâmpago ativa', count(*) = 1 from public.flash_deals where id = (select v::bigint from ids where k='d1');
insert into r select 'visitante não cria oferta', pg_temp.err(format('select public.create_flash_deal(%L, 5000, null, 2)', (select v from ids where k='caixa'))) like '%permission denied%';
reset role;

-- Fim da oferta (agendador): o preço normal volta
update public.flash_deals set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' where id = (select v::bigint from ids where k='d1');
select private.run_flash_deals();
insert into r select 'oferta terminada', status = 'ended' from public.flash_deals where id = (select v::bigint from ids where k='d1');
insert into r select 'preço normal volta e o "de" some', price_cents = 10000 and compare_at_cents is null and discount_pct is null
  from public.products where id = (select v::uuid from ids where k='fone');

-- Oferta agendada (produto que já tinha preço "de"): só começa na hora marcada
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into ids values ('d2', public.create_flash_deal((select v::uuid from ids where k='caixa'), 6000, now() + interval '1 hour', 3)::text);
insert into r select 'oferta agendada não muda o preço antes da hora', d.status = 'scheduled' and p.price_cents = 8000
  from public.flash_deals d join public.products p on p.id = d.product_id where d.id = (select v::bigint from ids where k='d2');
reset role;
update public.flash_deals set starts_at = now() - interval '1 minute', ends_at = now() + interval '2 hours' where id = (select v::bigint from ids where k='d2');
select private.run_flash_deals();
insert into r select 'agendador liga a oferta na hora', d.status = 'active' and p.price_cents = 6000 and p.compare_at_cents = 8000
  from public.flash_deals d join public.products p on p.id = d.product_id where d.id = (select v::bigint from ids where k='d2');

-- Loja encerra antes da hora: volta o preço e o "de" que ela tinha
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select public.cancel_flash_deal((select v::bigint from ids where k='d2'));
reset role;
insert into r select 'loja encerra: volta o preço e o "de" anteriores', d.status = 'cancelled' and p.price_cents = 8000 and p.compare_at_cents = 10000
  from public.flash_deals d join public.products p on p.id = d.product_id where d.id = (select v::bigint from ids where k='d2');

-- Se a loja muda o preço durante a oferta, o fim não desfaz a escolha dela
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into ids values ('d3', public.create_flash_deal((select v::uuid from ids where k='fone'), 8000, null, 1)::text);
update public.products set price_cents = 7500 where id = (select v::uuid from ids where k='fone');
select public.cancel_flash_deal((select v::bigint from ids where k='d3'));
reset role;
insert into r select 'preço mudado pela loja durante a oferta é mantido', price_cents = 7500 and compare_at_cents is null
  from public.products where id = (select v::uuid from ids where k='fone');

insert into r select 'agendador roda a cada minuto', count(*) = 1 from cron.job where jobname = 'zexi-flash-deals' and schedule = '* * * * *';

select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where not coalesce(ok, false)) as falhas from r;
rollback;
