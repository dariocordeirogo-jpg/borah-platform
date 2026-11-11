-- Teste do LIVELANCE PAY (Fase 4). Roda numa transação e desfaz tudo (rollback).
-- Os avisos da Stripe são simulados e assinados aqui com o mesmo segredo do Vault.
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000a4','vend4@teste.livelance','{"full_name":"Vendedor"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b4','ana4@teste.livelance','{"full_name":"Ana Souza"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c4','bia4@teste.livelance','{"full_name":"Bia Lima"}','authenticated','authenticated');
create temp table r(test text, ok boolean) on commit drop;
create temp table ids(k text primary key, v text) on commit drop;
grant all on r, ids to authenticated, anon;

-- Segredo de teste (só se ainda não existir; o rollback desfaz)
select vault.create_secret('whsec_teste_livelance_0123456789abcdef', 'stripe_webhook_secret')
where not exists (select 1 from vault.secrets where name = 'stripe_webhook_secret');

create function pg_temp.as_user(_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.err(_sql text) returns text language plpgsql as $$
begin execute _sql; return null; exception when others then return sqlerrm; end $$;
-- Monta um evento e assina como a Stripe: t=<unix>,v1=hmac_sha256(t.payload)
create function pg_temp.evt(_id text, _type text, _obj jsonb, _live boolean default false) returns text language sql as $$
  select jsonb_build_object('id', _id, 'object', 'event', 'type', _type, 'livemode', _live, 'data', jsonb_build_object('object', _obj))::text
$$;
create function pg_temp.sig(_payload text, _age integer default 0) returns text language sql security definer as $$
  select format('t=%s,v1=%s', extract(epoch from now())::bigint - _age,
    encode(extensions.hmac(convert_to((extract(epoch from now())::bigint - _age)::text || '.' || _payload, 'UTF8'),
      convert_to((select decrypted_secret from vault.decrypted_secrets where name = 'stripe_webhook_secret' limit 1), 'UTF8'), 'sha256'), 'hex'))
$$;
create function pg_temp.send(_id text, _type text, _obj jsonb, _live boolean default false) returns jsonb language sql as $$
  select public.stripe_ingest_event(pg_temp.evt(_id, _type, _obj, _live), pg_temp.sig(pg_temp.evt(_id, _type, _obj, _live)))
$$;
create function pg_temp.session(_id text, _pid text, _amount integer, _status text, _pi text) returns jsonb language sql as $$
  select jsonb_build_object('id', _id, 'object', 'checkout.session', 'client_reference_id', _pid,
    'metadata', jsonb_build_object('payment_id', _pid), 'amount_total', _amount, 'currency', 'brl',
    'payment_status', _status, 'payment_intent', _pi)
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- Vendedor: loja e produto
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
insert into ids values ('store', public.create_store('Loja Pay', 'loja-pay-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='store'), 'Fone', 10000, 5, 'active');
insert into ids select 'p', id from public.products where title = 'Fone';

-- Comprador: pedido de 2 unidades (R$ 200,00)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b4');
insert into public.addresses (user_id, recipient, cep, street, number, district, city, state)
  values ('00000000-0000-0000-0000-0000000000b4','Ana','01001000','Praça da Sé','1','Sé','São Paulo','SP');
insert into ids select 'addr', id from public.addresses;
insert into public.cart_items (user_id, product_id, quantity) values ('00000000-0000-0000-0000-0000000000b4', (select v::uuid from ids where k='p'), 2);
insert into ids select 'o1', (public.checkout((select v::uuid from ids where k='addr')))[1];
insert into r select 'loja sem conta Stripe não recebe',
  pg_temp.err(format('select public.start_order_payment(%L)', (select v from ids where k='o1'))) = 'store_cannot_receive';
insert into r select 'comprador sem loja não registra conta', pg_temp.err($q$select public.register_payout_account('acct_1ABCDEFGH')$q$) = 'store_required';

-- Vendedor registra a conta (ainda não verificada)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
insert into r select 'registra conta de recebimento', public.register_payout_account('acct_1TESTLOJA4') = 'acct_1TESTLOJA4';
insert into r select 'segunda conta não substitui a primeira', public.register_payout_account('acct_1OUTRACONTA') = 'acct_1TESTLOJA4';
insert into r select 'vendedor não altera a conta direto',
  pg_temp.err($q$update public.store_payment_accounts set verified = true$q$) like '%permission denied%';
insert into r select 'conta começa não verificada', not verified from public.store_payment_accounts;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b4');
insert into r select 'conta não verificada ainda não recebe',
  pg_temp.err(format('select public.start_order_payment(%L)', (select v from ids where k='o1'))) = 'store_cannot_receive';

-- Avisos sem login (anon): assinatura é obrigatória
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r select 'assinatura errada recusada',
  pg_temp.err($q$select public.stripe_ingest_event('{"id":"evt_x","type":"account.updated"}', 't=1,v1=abc')$q$) = 'invalid_signature';
insert into r select 'aviso antigo (replay) recusado',
  pg_temp.err(format('select public.stripe_ingest_event(%L, %L)', pg_temp.evt('evt_old', 'account.updated', '{}'),
    pg_temp.sig(pg_temp.evt('evt_old', 'account.updated', '{}'), 3600))) = 'invalid_signature';
insert into r select 'payload alterado depois de assinar é recusado',
  pg_temp.err(format('select public.stripe_ingest_event(%L, %L)', pg_temp.evt('evt_alt', 'account.updated', '{"x":2}'),
    pg_temp.sig(pg_temp.evt('evt_alt', 'account.updated', '{"x":1}')))) = 'invalid_signature';
insert into r select 'conta com loja errada é ignorada',
  pg_temp.send('evt_acc0', 'account.updated', jsonb_build_object('id', 'acct_1TESTLOJA4', 'charges_enabled', true,
    'metadata', jsonb_build_object('store_id', gen_random_uuid())))->>'result' = 'unknown_account';
insert into r select 'aviso de conta ativa a loja',
  pg_temp.send('evt_acc1', 'account.updated', jsonb_build_object('id', 'acct_1TESTLOJA4', 'charges_enabled', true,
    'payouts_enabled', false, 'details_submitted', true, 'requirements', jsonb_build_object('currently_due', jsonb_build_array('external_account')),
    'metadata', jsonb_build_object('store_id', (select v from ids where k='store'))))->>'result' = 'account_updated';
insert into r select 'aviso repetido não reprocessa',
  (pg_temp.send('evt_acc1', 'account.updated', '{}'))->>'duplicate' = 'true';
insert into r select 'anônimo não lê pagamentos', pg_temp.err('select count(*) from public.payments') like '%permission denied%'
  or (select count(*) from public.payments) = 0;
insert into r select 'comissão pública 10%', public.platform_fee_bps() = 1000;

-- Comprador inicia o pagamento
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b4');
insert into ids select 'pay1', public.start_order_payment((select v::uuid from ids where k='o1'))->>'payment_id';
insert into r select 'valor e comissão calculados no banco', amount_cents = 20000 and fee_cents = 2000 and net_cents = 18000
  and destination_account = 'acct_1TESTLOJA4' and status = 'created' from public.payments where id = (select v::uuid from ids where k='pay1');
insert into r select 'repetir reaproveita o mesmo pagamento',
  public.start_order_payment((select v::uuid from ids where k='o1'))->>'payment_id' = (select v from ids where k='pay1');
select public.attach_checkout_session((select v::uuid from ids where k='pay1'), 'cs_test_sessao1');
insert into r select 'sessão só é gravada uma vez',
  pg_temp.err(format('select public.attach_checkout_session(%L, %L)', (select v from ids where k='pay1'), 'cs_test_outra')) = 'payment_not_found';
insert into r select 'comprador não marca como pago direto',
  pg_temp.err($q$update public.payments set status = 'succeeded'$q$) like '%permission denied%';
insert into r select 'comprador não lê avisos', pg_temp.err('select count(*) from public.payment_events') like '%permission denied%';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c4');
insert into r select 'outro usuário não paga pedido alheio',
  pg_temp.err(format('select public.start_order_payment(%L)', (select v from ids where k='o1'))) = 'order_not_found';
insert into r select 'outro usuário não vê o pagamento', count(*) = 0 from public.payments;

-- Pix gerado (aguardando) → depois confirmado
set local role anon;
insert into r select 'Pix gerado deixa em processamento',
  pg_temp.send('evt_s1', 'checkout.session.completed', pg_temp.session('cs_test_sessao1', (select v from ids where k='pay1'), 20000, 'unpaid', 'pi_test_1'))->>'result' = 'processing';
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b4');
insert into r select 'com Pix em processamento não cancela',
  pg_temp.err(format('select public.cancel_order(%L)', (select v from ids where k='o1'))) = 'payment_processing';
insert into r select 'com Pix em processamento não abre outro pagamento',
  pg_temp.err(format('select public.start_order_payment(%L)', (select v from ids where k='o1'))) = 'payment_processing';
set local role anon;
insert into r select 'sessão de outro pagamento é recusada',
  pg_temp.send('evt_s2', 'checkout.session.async_payment_succeeded', pg_temp.session('cs_test_falsa', (select v from ids where k='pay1'), 20000, 'paid', 'pi_test_1'))->>'result' = 'session_mismatch';
insert into r select 'Pix confirmado marca como pago',
  pg_temp.send('evt_s3', 'checkout.session.async_payment_succeeded', pg_temp.session('cs_test_sessao1', (select v from ids where k='pay1'), 20000, 'paid', 'pi_test_1'))->>'result' = 'paid';
insert into r select 'confirmação repetida (outro aviso) não duplica',
  pg_temp.send('evt_s4', 'checkout.session.completed', pg_temp.session('cs_test_sessao1', (select v from ids where k='pay1'), 20000, 'paid', 'pi_test_1'))->>'result' = 'already_paid';
reset role;
insert into r select 'pedido pago', status = 'paid' from public.orders where id = (select v::uuid from ids where k='o1');
insert into r select 'auditoria do pagamento', count(*) = 1 from public.audit_logs where action = 'order.paid' and entity_id = (select v from ids where k='o1');
insert into r select 'avisos registrados com resultado', count(*) = 6 from public.payment_events where event_id like 'evt_s%' or event_id like 'evt_acc%';

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
insert into r select 'loja vê o pagamento recebido', count(*) = 1 from public.payments where status = 'succeeded';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b4');
insert into r select 'pedido pago não paga de novo',
  pg_temp.err(format('select public.start_order_payment(%L)', (select v from ids where k='o1'))) = 'order_not_payable';

-- Reembolso total: pedido cancelado e estoque devolvido
set local role anon;
insert into r select 'reembolso parcial é ignorado',
  pg_temp.send('evt_r0', 'charge.refunded', jsonb_build_object('payment_intent', 'pi_test_1', 'refunded', false))->>'result' = 'partial_refund_ignored';
insert into r select 'reembolso total registrado',
  pg_temp.send('evt_r1', 'charge.refunded', jsonb_build_object('payment_intent', 'pi_test_1', 'refunded', true))->>'result' = 'refunded';
reset role;
insert into r select 'reembolso cancela o pedido', status = 'cancelled' from public.orders where id = (select v::uuid from ids where k='o1');
insert into r select 'reembolso devolve o estoque', stock = 5 from public.products where id = (select v::uuid from ids where k='p');

-- Pedido cancelado com sessão aberta: se pagar mesmo assim, o banco manda devolver
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b4');
insert into public.cart_items (user_id, product_id, quantity) values ('00000000-0000-0000-0000-0000000000b4', (select v::uuid from ids where k='p'), 1);
insert into ids select 'o2', (public.checkout((select v::uuid from ids where k='addr')))[1];
insert into ids select 'pay2', public.start_order_payment((select v::uuid from ids where k='o2'))->>'payment_id';
select public.attach_checkout_session((select v::uuid from ids where k='pay2'), 'cs_test_sessao2');
select public.cancel_order((select v::uuid from ids where k='o2'));
insert into r select 'cancelar expira o pagamento aberto', status = 'expired' from public.payments where id = (select v::uuid from ids where k='pay2');
set local role anon;
insert into r select 'pagou pedido cancelado → devolver',
  (select x->>'result' = 'order_not_payable' and x->>'action' = 'refund' and x->>'payment_intent' = 'pi_test_2'
   from (select pg_temp.send('evt_c2', 'checkout.session.completed', pg_temp.session('cs_test_sessao2', (select v from ids where k='pay2'), 10000, 'paid', 'pi_test_2')) x) t);
reset role;
insert into r select 'pedido cancelado continua cancelado', status = 'cancelled' from public.orders where id = (select v::uuid from ids where k='o2');
insert into r select 'pagamento marcado para devolução', needs_refund from public.payments where id = (select v::uuid from ids where k='pay2');

-- Valor diferente do combinado: não marca como pago
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b4');
insert into public.cart_items (user_id, product_id, quantity) values ('00000000-0000-0000-0000-0000000000b4', (select v::uuid from ids where k='p'), 1);
insert into ids select 'o3', (public.checkout((select v::uuid from ids where k='addr')))[1];
insert into ids select 'pay3', public.start_order_payment((select v::uuid from ids where k='o3'))->>'payment_id';
set local role anon;
insert into r select 'valor diferente → recusado e devolvido',
  pg_temp.send('evt_m3', 'checkout.session.completed', pg_temp.session('cs_test_sessao3', (select v from ids where k='pay3'), 100, 'paid', 'pi_test_3'))->>'action' = 'refund';
insert into r select 'aviso de produção ignorado com a flag desligada',
  pg_temp.send('evt_live', 'checkout.session.completed', pg_temp.session('cs_live_x', (select v from ids where k='pay3'), 10000, 'paid', 'pi_live_1'), true)->>'result' = 'livemode_disabled';
reset role;
insert into r select 'pedido com valor errado segue aguardando', status = 'pending_payment' from public.orders where id = (select v::uuid from ids where k='o3');

-- Sessão expirada libera um novo pagamento
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b4');
insert into ids select 'pay3b', public.start_order_payment((select v::uuid from ids where k='o3'))->>'payment_id';
insert into r select 'novo pagamento depois de falha', (select v from ids where k='pay3b') <> (select v from ids where k='pay3');
set local role anon;
insert into r select 'sessão expirada registrada',
  pg_temp.send('evt_e3', 'checkout.session.expired', pg_temp.session('cs_test_sessao3b', (select v from ids where k='pay3b'), 10000, 'unpaid', null))->>'result' = 'expired';
reset role;
insert into r select 'pagamento expirado', status = 'expired' from public.payments where id = (select v::uuid from ids where k='pay3b');

select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where not ok) as falhas from r;
rollback;
