-- Teste do ZEXI MARKET (Fase 2). Roda numa transação e desfaz tudo (rollback).
-- Todas as linhas devem vir com ok = true.
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-0000000000a1','vendedor@teste.livelance','{"full_name":"Vendedor"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b1','comprador@teste.livelance','{"full_name":"Comprador"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c1','outro@teste.livelance','{"full_name":"Outro"}','authenticated','authenticated');

create temp table r(test text, ok boolean) on commit drop;
create temp table ids(k text primary key, v uuid) on commit drop;
grant all on r, ids to authenticated, anon;

-- Vendedor cria loja e produto
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
insert into ids values ('store', public.create_store('Loja Teste', 'loja-teste', 'Descrição'));
insert into r select 'vendedor ganhou papel seller', exists(select 1 from public.user_roles where role='seller');
insert into public.products (store_id, title, price_cents, stock, status)
  values ((select v from ids where k='store'), 'Fone Teste', 10000, 2, 'active');
insert into ids select 'p1', id from public.products where title='Fone Teste';
insert into public.products (store_id, title, price_cents, stock, status)
  values ((select v from ids where k='store'), 'Rascunho', 5000, 5, 'draft');
do $$ begin
  begin perform public.create_store('Outra', 'outra-loja');
    insert into r values ('não cria segunda loja', false);
  exception when others then insert into r values ('não cria segunda loja', true); end;
end $$;

-- Outro usuário não altera produto alheio nem cria produto na loja alheia
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}',true);
with u as (update public.products set price_cents = 1 where id = (select v from ids where k='p1') returning 1)
insert into r select 'outro NÃO altera preço alheio', count(*)=0 from u;
do $$ begin
  begin insert into public.products (store_id, title, price_cents) values ((select v from ids where k='store'), 'Invasor', 100);
    insert into r values ('outro NÃO cria produto na loja alheia', false);
  exception when others then insert into r values ('outro NÃO cria produto na loja alheia', true); end;
end $$;
insert into r select 'rascunho invisível para terceiros', count(*)=0 from public.products where title='Rascunho';

-- Comprador: carrinho, endereço e pedido
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}',true);
insert into public.addresses (user_id, recipient, cep, street, number, district, city, state)
  values ('00000000-0000-0000-0000-0000000000b1','Comprador','01001000','Praça da Sé','1','Sé','São Paulo','SP');
insert into ids select 'addr', id from public.addresses;
insert into public.cart_items (user_id, product_id, quantity) values ('00000000-0000-0000-0000-0000000000b1', (select v from ids where k='p1'), 3);
do $$ begin
  begin perform public.checkout((select v from ids where k='addr'));
    insert into r values ('recusa pedido acima do estoque', false);
  exception when others then insert into r values ('recusa pedido acima do estoque', sqlerrm like 'insufficient_stock%'); end;
end $$;
update public.cart_items set quantity = 2;
insert into ids select 'o1', (public.checkout((select v from ids where k='addr')))[1];
insert into r select 'pedido criado com total certo', total_cents = 20000 and status = 'pending_payment' from public.orders where id = (select v from ids where k='o1');
insert into r select 'carrinho esvaziado', count(*)=0 from public.cart_items;
do $$ begin
  begin insert into public.orders (buyer_id, store_id, subtotal_cents, total_cents, shipping_address)
    values ('00000000-0000-0000-0000-0000000000b1', (select v from ids where k='store'), 1, 1, '{}');
    insert into r values ('comprador NÃO grava pedido direto', false);
  exception when others then insert into r values ('comprador NÃO grava pedido direto', true); end;
end $$;

-- Estoque zerado: novo pedido é recusado
insert into public.cart_items (user_id, product_id, quantity) values ('00000000-0000-0000-0000-0000000000b1', (select v from ids where k='p1'), 1);
do $$ begin
  begin perform public.checkout((select v from ids where k='addr'));
    insert into r values ('estoque zerado recusa novo pedido', false);
  exception when others then insert into r values ('estoque zerado recusa novo pedido', true); end;
end $$;
delete from public.cart_items;

-- Terceiro não vê o pedido
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}',true);
insert into r select 'terceiro NÃO vê pedido', count(*)=0 from public.orders;
do $$ begin
  begin perform public.cancel_order((select v from ids where k='o1'));
    insert into r values ('terceiro NÃO cancela pedido', false);
  exception when others then insert into r values ('terceiro NÃO cancela pedido', true); end;
end $$;

-- Vendedor vê o pedido da loja e o estoque baixado; cancela e o estoque volta
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
insert into r select 'loja vê o pedido', count(*)=1 from public.orders;
insert into r select 'estoque baixou para 0', stock = 0 from public.products where id = (select v from ids where k='p1');
select public.cancel_order((select v from ids where k='o1'));
insert into r select 'cancelamento devolve estoque', stock = 2 from public.products where id = (select v from ids where k='p1');
insert into r select 'histórico de estoque: pedido e cancelamento', count(*)=2 from public.inventory_movements where product_id = (select v from ids where k='p1');
do $$ begin
  begin perform public.cancel_order((select v from ids where k='o1'));
    insert into r values ('não cancela duas vezes', false);
  exception when others then insert into r values ('não cancela duas vezes', true); end;
end $$;

-- Vendedor não compra o próprio produto
insert into public.addresses (user_id, recipient, cep, street, number, district, city, state)
  values ('00000000-0000-0000-0000-0000000000a1','Vendedor','01001000','Rua','1','Centro','São Paulo','SP');
insert into public.cart_items (user_id, product_id, quantity) values ('00000000-0000-0000-0000-0000000000a1', (select v from ids where k='p1'), 1);
do $$ begin
  begin perform public.checkout((select id from public.addresses where user_id='00000000-0000-0000-0000-0000000000a1'));
    insert into r values ('vendedor NÃO compra o próprio produto', false);
  exception when others then insert into r values ('vendedor NÃO compra o próprio produto', sqlerrm like 'own_product%'); end;
end $$;

-- Anônimo vê produto ativo, não vê pedidos nem carrinho
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
insert into r select 'anônimo vê produto ativo (não o rascunho)', count(*)=1 from public.products where store_id = (select v from ids where k='store');
do $$ begin
  begin perform 1 from public.orders; insert into r values ('anônimo NÃO lê pedidos', (select count(*) from public.orders)=0);
  exception when others then insert into r values ('anônimo NÃO lê pedidos', true); end;
  begin perform public.checkout(gen_random_uuid()); insert into r values ('anônimo NÃO chama checkout', false);
  exception when others then insert into r values ('anônimo NÃO chama checkout', true); end;
end $$;
reset role;
select count(*) filter (where ok) as ok, count(*) as total, string_agg(test, '; ') filter (where not ok) as falhas from r;
rollback;
