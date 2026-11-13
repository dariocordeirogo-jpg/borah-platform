-- Teste do pagamento único (Compra Garantida): uma cobrança para pedidos de duas lojas, dinheiro retido,
-- repasse após a entrega, reembolso por loja e devolução de parte de pedido que não aceita mais pagamento.
-- Os avisos entram pela função real (stripe_ingest_event) com assinatura feita com o segredo do Vault. Transação + rollback.
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000f1','loja-a-pu@teste.zexi','{"full_name":"Loja A"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f2','loja-b-pu@teste.zexi','{"full_name":"Loja B"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f3','comp-pu@teste.zexi','{"full_name":"Compradora"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f4','outro-pu@teste.zexi','{"full_name":"Outro"}','authenticated','authenticated');
create temp table r(test text, ok boolean) on commit drop;
create temp table ids(k text primary key, v text) on commit drop;
grant all on r, ids to authenticated, anon;
create function pg_temp.as_user(_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.err(_sql text) returns text language plpgsql as $$
begin execute _sql; return null; exception when others then return sqlerrm; end $$;
-- Assina como a Stripe (só o dono do banco lê o segredo)
create function pg_temp.sig(_payload text) returns text language sql as $$
  select 't=' || extract(epoch from now())::bigint || ',v1=' || encode(extensions.hmac(
    convert_to(extract(epoch from now())::bigint || '.' || _payload, 'UTF8'),
    convert_to((select decrypted_secret from vault.decrypted_secrets where name = 'stripe_webhook_secret'), 'UTF8'), 'sha256'), 'hex')
$$;
create function pg_temp.evt(_id text, _type text, _obj jsonb) returns jsonb language sql as $$
  select public.stripe_ingest_event(p, pg_temp.sig(p))
  from (select json_build_object('id', _id, 'object', 'event', 'type', _type, 'livemode', false, 'data', json_build_object('object', _obj))::text as p) x
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- Duas lojas com recebimento ativo
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
insert into ids values ('sa', public.create_store('Loja A PU', 'loja-a-pu-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='sa'), 'Tênis PU', 20000, 5, 'active');
insert into ids select 'pa', id from public.products where title = 'Tênis PU';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
insert into ids values ('sb', public.create_store('Loja B PU', 'loja-b-pu-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v::uuid from ids where k='sb'), 'Boné PU', 5000, 5, 'active');
insert into ids select 'pb', id from public.products where title = 'Boné PU';
reset role;
insert into public.store_payment_accounts (store_id, account_id, verified, charges_enabled, payouts_enabled, details_submitted) values
  ((select v::uuid from ids where k='sa'), 'acct_1PULOJAAAAAA', true, true, true, true),
  ((select v::uuid from ids where k='sb'), 'acct_1PULOJABBBBB', true, true, true, true);

-- Compradora: carrinho com as duas lojas → dois pedidos
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
insert into public.addresses (user_id, recipient, cep, street, number, district, city, state)
  values ('00000000-0000-0000-0000-0000000000f3','Ana','01001000','Praça da Sé','1','Sé','São Paulo','SP');
insert into public.cart_items (user_id, product_id, quantity) values
  ('00000000-0000-0000-0000-0000000000f3', (select v::uuid from ids where k='pa'), 1),
  ('00000000-0000-0000-0000-0000000000f3', (select v::uuid from ids where k='pb'), 2);
insert into ids select 'orders', array_to_string(public.checkout((select id from public.addresses where user_id = '00000000-0000-0000-0000-0000000000f3')), ',');
insert into ids select 'oa', id from public.orders where store_id = (select v::uuid from ids where k='sa') and buyer_id = '00000000-0000-0000-0000-0000000000f3';
insert into ids select 'ob', id from public.orders where store_id = (select v::uuid from ids where k='sb') and buyer_id = '00000000-0000-0000-0000-0000000000f3';
insert into r select 'checkout criou um pedido por loja', (select count(*) from ids where k in ('oa','ob')) = 2;

-- Outra pessoa não paga pedidos alheios
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f4');
insert into r select 'outra pessoa não inicia pagamento de pedido alheio',
  pg_temp.err(format('select public.start_cart_payment(array[%L,%L]::uuid[])', (select v from ids where k='oa'), (select v from ids where k='ob'))) = 'order_not_found';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
insert into ids select 'g', public.start_cart_payment(array[(select v::uuid from ids where k='oa'), (select v::uuid from ids where k='ob')]) ->> 'checkout_payment_id';
insert into r select 'cobrança única soma os dois pedidos',
  (select amount_cents from public.checkout_payments where id = (select v::uuid from ids where k='g'))
  = (select sum(total_cents) from public.orders where id in ((select v::uuid from ids where k='oa'), (select v::uuid from ids where k='ob')));
insert into r select 'uma parte por loja, com comissão calculada no banco',
  (select count(*) from public.payments where checkout_payment_id = (select v::uuid from ids where k='g') and fee_cents > 0 and status = 'created') = 2;
insert into r select 'pedir de novo reaproveita a mesma cobrança',
  public.start_cart_payment(array[(select v::uuid from ids where k='ob'), (select v::uuid from ids where k='oa')]) ->> 'checkout_payment_id' = (select v from ids where k='g');
insert into r select 'compradora vê a própria cobrança', count(*) = 1 from public.checkout_payments where id = (select v::uuid from ids where k='g');
insert into r select 'compradora não escreve na cobrança',
  pg_temp.err(format('update public.checkout_payments set status = %L where id = %L', 'succeeded', (select v from ids where k='g'))) like '%permission denied%';
select public.attach_cart_session((select v::uuid from ids where k='g'), 'cs_test_PUunico1');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f4');
insert into r select 'outra pessoa não vê a cobrança', count(*) = 0 from public.checkout_payments where id = (select v::uuid from ids where k='g');

-- Aviso da Stripe (conta da Zexi, sem "account"): valor errado é recusado
reset role;
insert into r select 'aviso com valor diferente não paga nada',
  pg_temp.evt('evt_pu_wrong', 'checkout.session.completed', jsonb_build_object(
    'id', 'cs_test_PUunico1', 'client_reference_id', (select v from ids where k='g'),
    'metadata', jsonb_build_object('checkout_payment_id', (select v from ids where k='g')),
    'amount_total', 1, 'currency', 'brl', 'payment_status', 'paid', 'payment_intent', 'pi_pu_1')) ->> 'result' = 'amount_mismatch';
-- Volta a cobrança ao estado aberto para seguir o teste
update public.checkout_payments set status = 'created', needs_refund = false, failure_reason = null where id = (select v::uuid from ids where k='g');
update public.payments set status = 'created', failure_reason = null where checkout_payment_id = (select v::uuid from ids where k='g');

insert into r select 'aviso de pagamento confirma a cobrança única',
  pg_temp.evt('evt_pu_paid', 'checkout.session.completed', jsonb_build_object(
    'id', 'cs_test_PUunico1', 'client_reference_id', (select v from ids where k='g'),
    'metadata', jsonb_build_object('checkout_payment_id', (select v from ids where k='g')),
    'amount_total', (select amount_cents from public.checkout_payments where id = (select v::uuid from ids where k='g')),
    'currency', 'brl', 'payment_status', 'paid', 'payment_intent', 'pi_pu_1')) ->> 'result' = 'paid';
insert into r select 'os dois pedidos ficam pagos', count(*) = 2 from public.orders
  where id in ((select v::uuid from ids where k='oa'), (select v::uuid from ids where k='ob')) and status = 'paid';
insert into r select 'dinheiro das lojas fica retido até a entrega', count(*) = 2 from public.payments
  where checkout_payment_id = (select v::uuid from ids where k='g') and status = 'succeeded' and payout_status = 'held';
insert into r select 'aviso repetido é ignorado',
  (pg_temp.evt('evt_pu_paid', 'checkout.session.completed', '{}'::jsonb) ->> 'duplicate')::boolean;

-- Nada é repassado antes da entrega
insert into ids select 'claim0', public.claim_payouts(p, pg_temp.sig(p))::text from (select '{"kind":"zexi.payout.claim","limit":10}' p) x;
insert into r select 'sem entrega, nada na fila de repasse',
  not exists (select 1 from jsonb_array_elements((select v::jsonb from ids where k='claim0')) e
              where e ->> 'payment_id' in (select id::text from public.payments where checkout_payment_id = (select v::uuid from ids where k='g')));
insert into r select 'fila de repasse exige assinatura',
  pg_temp.err('select public.claim_payouts(''{"kind":"zexi.payout.claim"}'', ''t=1,v1=00'')') = 'invalid_signature';

-- Loja A envia; compradora confirma o recebimento → repasse liberado
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select public.ship_order((select v::uuid from ids where k='oa'), 'correios', 'PU123456789BR');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
select public.confirm_delivery((select v::uuid from ids where k='oa'));
reset role;
insert into r select 'entrega confirmada libera o repasse da loja A',
  payout_status = 'ready' and payout_ready_at is not null from public.payments
  where order_id = (select v::uuid from ids where k='oa') and status = 'succeeded';
insert into ids select 'claim1', public.claim_payouts(p, pg_temp.sig(p))::text from (select '{"kind":"zexi.payout.claim","limit":50}' p) x;
insert into r select 'fila entrega o repasse da loja A (valor líquido, conta e grupo certos)', exists (
  select 1 from jsonb_array_elements((select v::jsonb from ids where k='claim1')) e, public.payments p
  where p.order_id = (select v::uuid from ids where k='oa') and e ->> 'payment_id' = p.id::text
    and (e ->> 'amount_cents')::int = p.net_cents and e ->> 'destination' = 'acct_1PULOJAAAAAA'
    and e ->> 'transfer_group' = 'cp_' || (select v from ids where k='g') and e ->> 'payment_intent' = 'pi_pu_1');
insert into r select 'loja B (não entregue) fica fora da fila', not exists (
  select 1 from jsonb_array_elements((select v::jsonb from ids where k='claim1')) e
  where e ->> 'payment_id' = (select id::text from public.payments where order_id = (select v::uuid from ids where k='ob') and status = 'succeeded'));
insert into r select 'repasse em andamento', payout_status = 'processing' and payout_attempts = 1
  from public.payments where order_id = (select v::uuid from ids where k='oa') and status = 'succeeded';

-- Falha na Stripe: volta para a fila
insert into r select 'falha no repasse volta para a fila',
  pg_temp.evt('evt_pu_fail', 'zexi.payout_failed', jsonb_build_object('payment_id',
    (select id from public.payments where order_id = (select v::uuid from ids where k='oa') and status = 'succeeded'), 'error', 'saldo indisponível')) ->> 'result' = 'payout_retry';
update public.payments set payout_status = 'processing' where order_id = (select v::uuid from ids where k='oa') and status = 'succeeded';

insert into r select 'transferência com valor errado não conta',
  pg_temp.evt('evt_pu_tr_bad', 'transfer.created', jsonb_build_object('id', 'tr_pu_bad', 'amount', 1, 'destination', 'acct_1PULOJAAAAAA',
    'transfer_group', 'cp_' || (select v from ids where k='g'),
    'metadata', jsonb_build_object('payment_id', (select id from public.payments where order_id = (select v::uuid from ids where k='oa') and status = 'succeeded'))))
  ->> 'result' = 'transfer_mismatch';
insert into r select 'transferência confirmada marca o repasse',
  pg_temp.evt('evt_pu_tr', 'transfer.created', (select jsonb_build_object('id', 'tr_pu_1', 'amount', net_cents, 'destination', destination_account,
    'transfer_group', 'cp_' || checkout_payment_id, 'metadata', jsonb_build_object('payment_id', id))
    from public.payments where order_id = (select v::uuid from ids where k='oa') and status = 'succeeded')) ->> 'result' = 'transferred';
insert into r select 'repasse transferido com id da transferência', payout_status = 'transferred' and transfer_id = 'tr_pu_1'
  from public.payments where order_id = (select v::uuid from ids where k='oa') and status = 'succeeded';

-- Loja B cancela a venda paga (não enviada): devolve só a parte dela
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
insert into r select 'outra loja não cancela venda alheia',
  pg_temp.err(format('select public.request_order_refund(%L)', (select v from ids where k='ob'))) = 'order_not_found';
insert into r select 'venda entregue e repassada não volta',
  pg_temp.err(format('select public.request_order_refund(%L)', (select v from ids where k='oa'))) = 'order_not_refundable';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
insert into ids select 'refund', public.request_order_refund((select v::uuid from ids where k='ob'))::text;
insert into r select 'pedido de devolução traz a parte e a cobrança certas',
  (select v::jsonb from ids where k='refund') ->> 'payment_intent' = 'pi_pu_1'
  and ((select v::jsonb from ids where k='refund') ->> 'amount_cents')::int = (select total_cents from public.orders where id = (select v::uuid from ids where k='ob'));
reset role;
insert into ids select 'stock_b', stock::text from public.products where id = (select v::uuid from ids where k='pb');
insert into r select 'aviso do reembolso parcial devolve a parte da loja B',
  pg_temp.evt('evt_pu_ref', 'refund.updated', jsonb_build_object('id', 're_pu_1', 'object', 'refund', 'status', 'succeeded',
    'payment_intent', 'pi_pu_1', 'amount', ((select v::jsonb from ids where k='refund') ->> 'amount_cents')::int,
    'metadata', jsonb_build_object('payment_id', (select v::jsonb from ids where k='refund') ->> 'payment_id'))) ->> 'result' = 'refunded';
insert into r select 'pedido da loja B cancelado', status = 'cancelled' from public.orders where id = (select v::uuid from ids where k='ob');
insert into r select 'estoque da loja B devolvido',
  stock = (select v::int from ids where k='stock_b') + 2 from public.products where id = (select v::uuid from ids where k='pb');
insert into r select 'parte da loja B reembolsada e sem repasse', status = 'refunded' and payout_status = 'cancelled'
  from public.payments where id = ((select v::jsonb from ids where k='refund') ->> 'payment_id')::uuid;
insert into r select 'pedido da loja A segue entregue', status = 'delivered' from public.orders where id = (select v::uuid from ids where k='oa');
insert into r select 'cobrança segue paga (parte da loja A)', status = 'succeeded' from public.checkout_payments where id = (select v::uuid from ids where k='g');

-- Pedido cancelado antes do pagamento cair: devolve só a parte dele
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
insert into public.cart_items (user_id, product_id, quantity) values
  ('00000000-0000-0000-0000-0000000000f3', (select v::uuid from ids where k='pa'), 1),
  ('00000000-0000-0000-0000-0000000000f3', (select v::uuid from ids where k='pb'), 1);
insert into ids select 'o2', array_to_string(public.checkout((select id from public.addresses where user_id = '00000000-0000-0000-0000-0000000000f3')), ',');
insert into ids select 'g2', public.start_cart_payment(string_to_array((select v from ids where k='o2'), ',')::uuid[]) ->> 'checkout_payment_id';
insert into ids select 'o2b', id from public.orders where id = any (string_to_array((select v from ids where k='o2'), ',')::uuid[])
  and store_id = (select v::uuid from ids where k='sb');
select public.cancel_order((select v::uuid from ids where k='o2b'));
reset role;
insert into ids select 'paid2', pg_temp.evt('evt_pu_paid2', 'checkout.session.completed', jsonb_build_object(
    'id', 'cs_test_PUunico2', 'client_reference_id', (select v from ids where k='g2'),
    'metadata', jsonb_build_object('checkout_payment_id', (select v from ids where k='g2')),
    'amount_total', (select amount_cents from public.checkout_payments where id = (select v::uuid from ids where k='g2')),
    'currency', 'brl', 'payment_status', 'paid', 'payment_intent', 'pi_pu_2'))::text;
insert into r select 'cobrança com pedido cancelado: paga a outra parte e pede devolução da cancelada',
  (select v::jsonb from ids where k='paid2') ->> 'result' = 'partially_paid'
  and (select v::jsonb from ids where k='paid2') ->> 'action' = 'refund_parts'
  and jsonb_array_length((select v::jsonb from ids where k='paid2') -> 'refunds') = 1;
insert into r select 'parte cancelada marcada para devolução', needs_refund and status = 'failed'
  from public.payments where order_id = (select v::uuid from ids where k='o2b') and checkout_payment_id = (select v::uuid from ids where k='g2');

-- Avisos da cobrança direta antiga (com "account") seguem o caminho antigo
insert into r select 'aviso de cobrança direta antiga (com account) não mexe na cobrança única',
  public.stripe_ingest_event(p, pg_temp.sig(p)) ->> 'result' = 'unknown_payment'
  from (select json_build_object('id', 'evt_pu_legacy', 'type', 'checkout.session.completed', 'account', 'acct_1PULOJAAAAAA',
    'data', json_build_object('object', json_build_object('id', 'cs_test_x', 'client_reference_id', (select v from ids where k='g2'),
    'metadata', json_build_object('checkout_payment_id', (select v from ids where k='g2')))))::text p) x;

select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where not ok) as falhas from r;
rollback;
