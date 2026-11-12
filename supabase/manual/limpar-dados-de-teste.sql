-- Zexi — limpeza dos dados de TESTE antes do lançamento.
-- NÃO é migration e NÃO roda sozinho. Rodar só com autorização explícita, no SQL Editor do Supabase.
--
-- Apaga tudo que pertence às contas de teste (e-mails @livelance.test): lojas, produtos, pedidos, pagamentos,
-- leilões, lives, vídeos, indicações, denúncias e as próprias contas. Contas reais não são tocadas.
-- Arquivos no Storage (fotos de produto e vídeos) NÃO são apagados por SQL: depois de rodar, apague as pastas
-- das lojas de teste nos buckets product-images e product-videos pelo painel (Storage).
--
-- Por segurança o script termina com ROLLBACK: rode uma vez, confira as contagens e só então troque por COMMIT.

begin;

create temp table _test_users on commit drop as
  select id from auth.users where email like '%@livelance.test';
create temp table _test_stores on commit drop as
  select id from public.stores where owner_id in (select id from _test_users);
create temp table _test_orders on commit drop as
  select id from public.orders
  where buyer_id in (select id from _test_users) or store_id in (select id from _test_stores);
create temp table _test_products on commit drop as
  select id from public.products where store_id in (select id from _test_stores);
create temp table _test_auctions on commit drop as
  select id from public.auctions
  where store_id in (select id from _test_stores) or product_id in (select id from _test_products)
     or order_id in (select id from _test_orders);

select (select count(*) from _test_users) as contas, (select count(*) from _test_stores) as lojas,
       (select count(*) from _test_products) as produtos, (select count(*) from _test_orders) as pedidos,
       (select count(*) from _test_auctions) as leiloes;

-- Pagamentos; e o registro de eventos do provedor em modo de teste (livemode = false)
delete from public.payment_events where not livemode;
delete from public.payments where order_id in (select id from _test_orders)
  or store_id in (select id from _test_stores) or buyer_id in (select id from _test_users);

-- Leilões (lances e eventos saem em cascata)
delete from public.auction_defaults where auction_id in (select id from _test_auctions);
delete from public.auctions where id in (select id from _test_auctions);

-- Pedidos (itens e comissões saem em cascata)
delete from public.inventory_movements where order_id in (select id from _test_orders)
  or product_id in (select id from _test_products);
delete from public.orders where id in (select id from _test_orders);

-- Denúncias sobre conteúdo das lojas de teste
delete from public.reports where target_id in (
  select id::text from _test_products union all select id::text from _test_stores
  union all select id::text from public.videos where store_id in (select id from _test_stores)
  union all select id::text from public.lives where store_id in (select id from _test_stores));

-- Lojas (vídeos, lives, conta de recebimento saem em cascata) e produtos
delete from public.products where id in (select id from _test_products);
delete from public.stores where id in (select id from _test_stores);

-- Contas (perfil, papéis, endereços, carrinho, verificação, afiliado, chat, curtidas, cota de IA em cascata)
delete from auth.users where id in (select id from _test_users);

select (select count(*) from auth.users where email like '%@livelance.test') as contas_de_teste_restantes,
       (select count(*) from public.stores) as lojas_restantes, (select count(*) from public.products) as produtos_restantes,
       (select count(*) from public.orders) as pedidos_restantes;

rollback; -- troque por COMMIT só depois de conferir
