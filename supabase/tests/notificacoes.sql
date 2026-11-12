-- Teste das notificações (fila de e-mail/SMS e código do celular). Roda numa transação e desfaz tudo (rollback).
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000e1','vende1@teste.livelance','{"full_name":"Vendedora E"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000e2','compe2@teste.livelance','{"full_name":"Comprador E"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000e3','outroe3@teste.livelance','{"full_name":"Outro"}','authenticated','authenticated');
create temp table r(test text, ok boolean) on commit drop;
create temp table ids(k text primary key, v text) on commit drop;
grant all on r, ids to authenticated, anon;
create function pg_temp.as_user(_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.err(_sql text) returns text language plpgsql as $$
begin execute _sql; return null; exception when others then return sqlerrm; end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;
-- Segredo de teste no Vault só dentro desta transação
select vault.create_secret(repeat('t', 40), 'outbox_secret_test');
update vault.secrets set name = 'outbox_secret_real' where name = 'outbox_secret';
update vault.secrets set name = 'outbox_secret' where name = 'outbox_secret_test';
delete from private.outbox;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
insert into ids values ('store', public.create_store('Loja Aviso', 'loja-aviso-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store'), 'Caneca aviso', 3000, 5, 'active');
insert into ids select 'p', id from public.products where title = 'Caneca aviso';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
insert into public.addresses (user_id, recipient, cep, street, number, district, city, state)
  values ('00000000-0000-0000-0000-0000000000e2','Comprador','01001000','Praça da Sé','1','Sé','São Paulo','SP');
insert into public.cart_items (user_id, product_id, quantity) values ('00000000-0000-0000-0000-0000000000e2', (select v::uuid from ids where k='p'), 2);
insert into ids select 'o', (public.place_order((select id from public.addresses where user_id = '00000000-0000-0000-0000-0000000000e2')))[1];
insert into r select 'usuário não lê a fila', pg_temp.err('select count(*) from private.outbox') like '%permission denied%';
select public.cancel_order((select v::uuid from ids where k='o'));

-- Código do celular
insert into r select 'sem verificação não pede código', pg_temp.err('select public.request_phone_code()') = 'verification_required';
select public.submit_verification('52998224725', '11987654321');
select public.request_phone_code();
insert into r select 'segundo pedido em menos de 1 minuto recusado', pg_temp.err('select public.request_phone_code()') = 'sms_too_soon';
insert into r select 'código errado recusado', pg_temp.err($q$select public.confirm_phone_code('000000')$q$) = 'sms_code_wrong'
  or pg_temp.err($q$select public.confirm_phone_code('111111')$q$) = 'sms_code_wrong';

reset role;
insert into r select 'pedido gera e-mail para comprador e loja',
  count(*) filter (where kind = 'order.created' and recipient = 'compe2@teste.livelance') = 1
  and count(*) filter (where kind = 'order.received' and recipient = 'vende1@teste.livelance') = 1
  from private.outbox;
insert into r select 'cancelamento gera e-mail para os dois',
  count(*) = 2 from private.outbox where kind in ('order.cancelled', 'order.cancelled.seller');
insert into r select 'SMS vai para o celular verificado', count(*) = 1 from private.outbox where channel = 'sms' and recipient = '+5511987654321';
insert into r select 'banco guarda só o hash do código',
  (select code_hash from private.phone_codes where user_id = '00000000-0000-0000-0000-0000000000e2') <> (select payload->>'code' from private.outbox where channel = 'sms');
insert into ids select 'code', payload->>'code' from private.outbox where channel = 'sms';

-- Entrega: só com o segredo
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r select 'sem segredo não entrega', pg_temp.err($q$select * from public.outbox_claim('errado', array['email'])$q$) = 'forbidden';
create temp table claimed on commit drop as select * from public.outbox_claim(repeat('t', 40), array['email'], 10);
insert into r select 'só o canal pedido', count(*) = 4 and bool_and(channel = 'email') from claimed;
insert into r select 'e-mail chega com os dados do pedido (total e loja)',
  bool_and((data->>'total_cents')::int = 6000 and data->>'store_name' = 'Loja Aviso' and jsonb_array_length(data->'items') = 1) from claimed;
insert into r select 'pegos não são pegos de novo', (select count(*) from public.outbox_claim(repeat('t', 40), array['email'], 10)) = 0;
select public.outbox_report(repeat('t', 40), id, true) from claimed where kind = 'order.created';
select public.outbox_report(repeat('t', 40), id, false, 'Resend 500') from claimed where kind <> 'order.created';
create temp table sms on commit drop as select * from public.outbox_claim(repeat('t', 40), array['sms']);
insert into r select 'SMS leva o código', (select data->>'code' from sms) = (select v from ids where k='code');
select public.outbox_report(repeat('t', 40), id, true) from sms;
reset role;
insert into r select 'enviado marcado; falha volta para a fila',
  (select status from private.outbox where kind = 'order.created') = 'sent'
  and (select count(*) from private.outbox where channel = 'email' and status = 'pending' and last_error = 'Resend 500') = 3;
insert into r select 'código some da fila depois de enviado', (select payload from private.outbox where channel = 'sms') is null;

-- Confirma com o código certo
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select public.confirm_phone_code((select v from ids where k='code'));
insert into r select 'código certo confirma o celular', phone_verified_at is not null from public.user_verifications where user_id = '00000000-0000-0000-0000-0000000000e2';
insert into r select 'depois de confirmado não pede outro', pg_temp.err('select public.request_phone_code()') = 'phone_already_verified';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
insert into r select 'usuário comum não vê estatísticas da fila', pg_temp.err('select public.admin_outbox_stats()') = 'forbidden';
reset role;

select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where ok is not true) as falhas from r;
rollback;
