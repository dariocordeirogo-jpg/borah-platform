-- Teste das perguntas e respostas no produto. Roda numa transação e desfaz tudo (rollback).
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000e1','vend-pq@teste.zexi','{"full_name":"Vendedor PQ"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000e2','ana-pq@teste.zexi','{"full_name":"Ana Pergunta"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000e3','bia-pq@teste.zexi','{"full_name":"Bia"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000e4','mod-pq@teste.zexi','{"full_name":"Moderadora"}','authenticated','authenticated');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000e4', 'moderator');
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
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
insert into ids values ('store', public.create_store('Loja PQ', 'loja-pq-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values
  ((select v::uuid from ids where k='store'), 'Capacete PQ', 50000, 2, 'active'),
  ((select v::uuid from ids where k='store'), 'Luva PQ', 9000, 2, 'draft');
insert into ids select 'p', id from public.products where title = 'Capacete PQ';
insert into ids select 'draft', id from public.products where title = 'Luva PQ';
insert into r select 'loja não pergunta no próprio produto',
  pg_temp.err(format('select public.ask_question(%L, %L)', (select v from ids where k='p'), 'Tem tamanho G?')) = 'own_product';

-- Ana pergunta
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
insert into r select 'pergunta curta demais recusada',
  pg_temp.err(format('select public.ask_question(%L, %L)', (select v from ids where k='p'), 'oi')) = 'invalid_question';
insert into r select 'e-mail na pergunta recusado',
  pg_temp.err(format('select public.ask_question(%L, %L)', (select v from ids where k='p'), 'me chama em ana@gmail.com')) = 'contact_not_allowed';
insert into r select 'telefone com separadores recusado',
  pg_temp.err(format('select public.ask_question(%L, %L)', (select v from ids where k='p'), 'liga (62) 9 9999-8888 por favor')) = 'contact_not_allowed';
insert into r select 'WhatsApp recusado',
  pg_temp.err(format('select public.ask_question(%L, %L)', (select v from ids where k='p'), 'tem whatsapp pra combinar?')) = 'contact_not_allowed';
insert into r select 'link recusado',
  pg_temp.err(format('select public.ask_question(%L, %L)', (select v from ids where k='p'), 'vi mais barato em www.outraloja.com')) = 'contact_not_allowed';
insert into r select 'produto em rascunho não recebe pergunta',
  pg_temp.err(format('select public.ask_question(%L, %L)', (select v from ids where k='draft'), 'Tem outras cores?')) = 'product_not_found';
insert into ids values ('q1', public.ask_question((select v::uuid from ids where k='p'), '  Serve   na cabeça 58?  ')::text);
insert into r select 'pergunta gravada limpa e com apelido', body = 'Serve na cabeça 58?' and asker_alias like 'A***%' and answer is null
  from public.product_questions where id = (select v::bigint from ids where k='q1');
insert into r select 'números de modelo, ano e medida são permitidos', pg_temp.err(format('select public.ask_question(%L, %L)', (select v from ids where k='p'), 'Serve na CB 500 2020, aro 17, tamanho 58?')) is null;
insert into r select 'ninguém grava pergunta direto na tabela',
  pg_temp.err(format('insert into public.product_questions (product_id, store_id, asker_id, asker_alias, body) values (%L, %L, %L, %L, %L)',
    (select v from ids where k='p'), (select v from ids where k='store'), '00000000-0000-0000-0000-0000000000e2', 'x', 'pergunta direta')) ~ 'permission denied|row-level security';

-- Outra pessoa não responde; a loja responde
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
insert into r select 'outra pessoa não responde',
  pg_temp.err(format('select public.answer_question(%L, %L)', (select v from ids where k='q1'), 'Serve sim')) = 'question_not_found';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
insert into r select 'resposta com telefone recusada',
  pg_temp.err(format('select public.answer_question(%L, %L)', (select v from ids where k='q1'), 'Me chama no 62999998888')) = 'contact_not_allowed';
select public.answer_question((select v::bigint from ids where k='q1'), 'Serve sim! Tamanho 58 é o M.');
insert into r select 'resposta gravada', answer = 'Serve sim! Tamanho 58 é o M.' and answered_at is not null
  from public.product_questions where id = (select v::bigint from ids where k='q1');
insert into r select 'loja vê as perguntas sem resposta da loja', count(*) = 1 from public.product_questions where store_id = (select v::uuid from ids where k='store') and answer is null;

-- Visitante lê as perguntas do produto à venda
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r select 'visitante lê perguntas do produto', count(*) = 2 from public.product_questions where product_id = (select v::uuid from ids where k='p');
insert into r select 'visitante não pergunta', pg_temp.err(format('select public.ask_question(%L, %L)', (select v from ids where k='p'), 'Tem nota fiscal?')) like '%permission denied%';
set local role authenticated;

-- Loja esconde uma pergunta; ela some para o público, mas quem perguntou ainda vê
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select public.hide_question((select v::bigint from ids where k='q1'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
insert into r select 'pergunta escondida some para os outros', count(*) = 0 from public.product_questions where id = (select v::bigint from ids where k='q1');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
insert into r select 'quem perguntou ainda vê a sua', count(*) = 1 from public.product_questions where id = (select v::bigint from ids where k='q1');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e4');
insert into r select 'moderação vê a escondida', count(*) = 1 from public.product_questions where id = (select v::bigint from ids where k='q1');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
insert into r select 'outra pessoa não esconde', pg_temp.err(format('select public.hide_question(%L)',
  (select id from public.product_questions where product_id = (select v::uuid from ids where k='p') and not hidden limit 1))) = 'question_not_found';

-- Limite: 10 perguntas por hora
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
select public.ask_question((select v::uuid from ids where k='p'), 'Pergunta número ' || g) from generate_series(1, 10) g;
insert into r select '11ª pergunta na mesma hora recusada',
  pg_temp.err(format('select public.ask_question(%L, %L)', (select v from ids where k='p'), 'Mais uma pergunta')) = 'too_many_questions';

reset role;
insert into r select 'loja avisada por e-mail (fila)', count(*) >= 1 from private.outbox where kind = 'question.received' and recipient = 'vend-pq@teste.zexi';
insert into r select 'quem perguntou avisado da resposta (fila)', count(*) = 1 from private.outbox where kind = 'question.answered' and recipient = 'ana-pq@teste.zexi';

select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where not coalesce(ok, false)) as falhas from r;
rollback;
