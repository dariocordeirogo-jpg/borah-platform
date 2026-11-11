-- Teste do motor de LIVELANCE LEILÕES (Fase 3). Roda numa transação e desfaz tudo (rollback).
-- Dentro de uma transação now() é fixo; o teste ajusta horários direto na tabela (como superusuário).
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000a3','vend3@teste.livelance','{"full_name":"Vendedor"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b3','ana3@teste.livelance','{"full_name":"Ana Souza"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c3','bia3@teste.livelance','{"full_name":"Bia Lima"}','authenticated','authenticated');
create temp table r(test text, ok boolean) on commit drop;
create temp table ids(k text primary key, v uuid) on commit drop;
grant all on r, ids to authenticated, anon;

create function pg_temp.as_user(_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.err(_sql text) returns text language plpgsql as $$
begin execute _sql; return null; exception when others then return sqlerrm; end $$;
grant execute on function pg_temp.err(text), pg_temp.as_user(text) to authenticated, anon;

-- Vendedor: loja, produto com 1 unidade, leilão de 60 min
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
insert into ids values ('store', public.create_store('Loja Leilão', 'loja-leilao-teste'));
insert into public.products (store_id, title, price_cents, stock, status) values ((select v from ids where k='store'), 'Relógio', 50000, 1, 'active');
insert into ids select 'p', id from public.products where title = 'Relógio';
insert into ids values ('a', public.create_auction((select v from ids where k='p'), 10000, 1000, null, null, 60));
insert into r select 'criar leilão reserva o estoque', stock = 0 from public.products where id = (select v from ids where k='p');
insert into r select 'sem estoque não cria 2º leilão', pg_temp.err(format('select public.create_auction(%L, 10000, 1000, null, null, 60)', (select v from ids where k='p'))) like '%no_stock%';
insert into r select 'vendedor não dá lance no próprio leilão',
  pg_temp.err(format('select public.place_bid(%L, 10000, %L)', (select v from ids where k='a'), 'k-own-0001')) in ('verification_required', 'own_auction');

-- Ana sem verificação
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
insert into r select 'sem verificação não dá lance',
  pg_temp.err(format('select public.place_bid(%L, 10000, %L)', (select v from ids where k='a'), 'k-ana-0001')) = 'verification_required';
insert into r select 'CPF inválido recusado', pg_temp.err($q$select public.submit_verification('123.456.789-00', '(11) 98888-7777')$q$) = 'cpf_invalid';
insert into r select 'telefone inválido recusado', pg_temp.err($q$select public.submit_verification('529.982.247-25', '1234')$q$) = 'phone_invalid';
select public.submit_verification('529.982.247-25', '(11) 98888-7777');
insert into r select 'CPF guardado mascarado', cpf_masked = '***.982.247-**' and phone = '+5511988887777' from public.user_verifications;

-- Bia tenta usar o CPF da Ana; depois usa o dela
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
insert into r select 'CPF de outra conta recusado', pg_temp.err($q$select public.submit_verification('52998224725', '11977776666')$q$) = 'cpf_in_use';
select public.submit_verification('111.444.777-35', '11977776666');

-- Lances
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
insert into r select 'lance abaixo do inicial recusado',
  pg_temp.err(format('select public.place_bid(%L, 9999, %L)', (select v from ids where k='a'), 'k-ana-0002')) = 'bid_too_low:10000';
select public.place_bid((select v from ids where k='a'), 10000, 'k-ana-0003');
insert into r select 'mesmo clique repetido não duplica', (public.place_bid((select v from ids where k='a'), 10000, 'k-ana-0003') ->> 'duplicate')::boolean;
insert into r select 'quem lidera não dá lance de novo',
  pg_temp.err(format('select public.place_bid(%L, 12000, %L)', (select v from ids where k='a'), 'k-ana-0004')) = 'already_leading';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
insert into r select 'incremento mínimo respeitado',
  pg_temp.err(format('select public.place_bid(%L, 10500, %L)', (select v from ids where k='a'), 'k-bia-0001')) = 'bid_too_low:11000';
insert into r select 'lance absurdo recusado',
  pg_temp.err(format('select public.place_bid(%L, 99999999, %L)', (select v from ids where k='a'), 'k-bia-0002')) like 'bid_too_high%';
select public.place_bid((select v from ids where k='a'), 11000, 'k-bia-0003');
insert into r select 'estado do leilão após 2 lances', current_price_cents = 11000 and bids_count = 2 and leader_alias = 'B***a'
  from public.auctions where id = (select v from ids where k='a');

-- Anti-sniping: faltando 60 s, novo lance empurra o fim para now()+120 s
reset role;
update public.auctions set ends_at = now() + interval '60 seconds' where id = (select v from ids where k='a');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
insert into r select 'anti-sniping estende o prazo', (public.place_bid((select v from ids where k='a'), 12000, 'k-ana-0005') ->> 'extended')::boolean;
insert into r select 'novo fim = agora + 2 min', ends_at = now() + interval '120 seconds' and extensions_count = 1
  from public.auctions where id = (select v from ids where k='a');

-- Ninguém escreve direto nas tabelas
insert into r select 'lance direto na tabela é bloqueado',
  pg_temp.err(format('insert into public.auction_bids (auction_id, bidder_id, bidder_alias, amount_cents, idempotency_key) values (%L, %L, %L, 1, %L)',
    (select v from ids where k='a'), '00000000-0000-0000-0000-0000000000b3', 'x', 'k-direct-01')) is not null;
with u as (update public.auctions set ends_at = now() where id = (select v from ids where k='a') returning 1)
insert into r select 'alterar prazo direto é bloqueado', count(*) = 0 from u;

-- Encerramento: Ana vence com R$ 120
reset role;
update public.auctions set starts_at = now() - interval '2 hours', ends_at = now() - interval '1 second' where id = (select v from ids where k='a');
select private.run_auction_jobs();
insert into r select 'encerrado com vencedor', status = 'ended' and outcome = 'sold' and winner_id = '00000000-0000-0000-0000-0000000000b3'
  and winning_bid_cents = 12000 and payment_due_at = now() + interval '48 hours' from public.auctions where id = (select v from ids where k='a');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
insert into r select 'lance depois do fim recusado',
  pg_temp.err(format('select public.place_bid(%L, 50000, %L)', (select v from ids where k='a'), 'k-bia-0009')) = 'auction_closed';
insert into public.addresses (user_id, recipient, cep, street, number, district, city, state)
  values ('00000000-0000-0000-0000-0000000000c3', 'Bia', '01001000', 'Rua', '1', 'Centro', 'São Paulo', 'SP');
insert into r select 'quem perdeu não confirma o arremate',
  pg_temp.err(format('select public.confirm_auction_win(%L, %L)', (select v from ids where k='a'),
    (select id from public.addresses where user_id = '00000000-0000-0000-0000-0000000000c3'))) = 'auction_not_found';

-- Ana não confirma em 48 h → perde, lote volta, Ana não pode dar lance no relançado
reset role;
insert into public.auction_defaults (user_id, auction_id) values
  ('00000000-0000-0000-0000-0000000000b3', (select v from ids where k='a')),
  ('00000000-0000-0000-0000-0000000000b3', (select v from ids where k='a'));
update public.auctions set payment_due_at = now() - interval '1 second' where id = (select v from ids where k='a');
select private.run_auction_jobs();
insert into ids select 'a2', id from public.auctions where lineage_id = (select v from ids where k='a') and relist_count = 1;
insert into r select 'inadimplente: lote marcado como não pago', outcome = 'unpaid' from public.auctions where id = (select v from ids where k='a');
insert into r select 'lote volta ao leilão (mesma linhagem, ativo)', status = 'active' and current_price_cents is null and bids_count = 0
  from public.auctions where id = (select v from ids where k='a2');
insert into r select '3ª inadimplência bloqueia por 7 dias', blocked_until = now() + interval '7 days'
  from public.bid_blocks where user_id = '00000000-0000-0000-0000-0000000000b3';
insert into r select 'estoque continua reservado para o relançado', stock = 0 from public.products where id = (select v from ids where k='p');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
insert into r select 'inadimplente bloqueado não dá lance',
  pg_temp.err(format('select public.place_bid(%L, 10000, %L)', (select v from ids where k='a2'), 'k-ana-0010')) = 'bid_blocked';
reset role;
delete from public.bid_blocks where user_id = '00000000-0000-0000-0000-0000000000b3';
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
insert into r select 'inadimplente não volta àquele lote',
  pg_temp.err(format('select public.place_bid(%L, 10000, %L)', (select v from ids where k='a2'), 'k-ana-0011')) = 'auction_banned';

-- Bia arremata o relançado e confirma → pedido criado
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
select public.place_bid((select v from ids where k='a2'), 10000, 'k-bia-0010');
reset role;
update public.auctions set starts_at = now() - interval '2 hours', ends_at = now() - interval '1 second' where id = (select v from ids where k='a2');
select private.run_auction_jobs();
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
insert into ids select 'o', public.confirm_auction_win((select v from ids where k='a2'), (select id from public.addresses where user_id = '00000000-0000-0000-0000-0000000000c3'));
insert into r select 'confirmar arremate cria o pedido', total_cents = 10000 and status = 'pending_payment' from public.orders where id = (select v from ids where k='o');
insert into r select 'meus lances mostra a vitória', is_winner and order_id = (select v from ids where k='o') from public.my_bids() where auction_id = (select v from ids where k='a2');

-- Sem lances: devolve o estoque. Reserva não atingida: devolve o estoque. Cancelar com lance: proibido.
reset role;
update public.products set stock = 3 where id = (select v from ids where k='p');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
insert into ids values ('a3', public.create_auction((select v from ids where k='p'), 10000, 1000, null, null, 60));
insert into ids values ('a4', public.create_auction((select v from ids where k='p'), 10000, 1000, 50000, null, 60));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
select public.place_bid((select v from ids where k='a4'), 20000, 'k-bia-0020');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
insert into r select 'loja não cancela leilão com lance',
  pg_temp.err(format('select public.cancel_auction(%L)', (select v from ids where k='a4'))) = 'auction_has_bids';
reset role;
update public.auctions set starts_at = now() - interval '2 hours', ends_at = now() - interval '1 second' where id in ((select v from ids where k='a3'), (select v from ids where k='a4'));
select private.run_auction_jobs();
insert into r select 'sem lances: encerrado e estoque devolvido', (select outcome from public.auctions where id = (select v from ids where k='a3')) = 'no_bids';
insert into r select 'reserva não atingida: sem vencedor', (select outcome = 'reserve_not_met' and winner_id is null from public.auctions where id = (select v from ids where k='a4'));
insert into r select 'estoque volta a 3 (2 reservas devolvidas)', stock = 3 from public.products where id = (select v from ids where k='p');

-- Visitante lê leilões e lances, não dá lance
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into r select 'visitante vê leilões', count(*) >= 1 from public.auctions;
insert into r select 'visitante vê lances (apelido)', count(*) >= 1 from public.auction_bids;
insert into r select 'visitante não dá lance', pg_temp.err(format('select public.place_bid(%L, 99000, %L)', (select v from ids where k='a2'), 'k-anon-001')) is not null;
reset role;
select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where not coalesce(ok, false)) as falhas from r;
rollback;
