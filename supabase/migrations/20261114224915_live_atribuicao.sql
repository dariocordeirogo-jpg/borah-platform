-- Atribuição de vendas à live: o item entra no carrinho marcado com a live de onde veio
-- e o pedido herda essa marca no checkout. Serve para a loja ver quanto cada live vendeu.
alter table public.cart_items add column live_id uuid references public.lives (id) on delete set null;
alter table public.orders add column live_id uuid references public.lives (id) on delete set null;
create index orders_live_idx on public.orders (live_id) where live_id is not null;

-- Só vale a marca se o produto estiver na live (programada ou no ar); senão é descartada sem erro
create function private.cart_live_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.live_id is not null and not exists (
    select 1 from public.live_products lp join public.lives l on l.id = lp.live_id
    where lp.live_id = new.live_id and lp.product_id = new.product_id and l.status in ('scheduled', 'live')
  ) then
    new.live_id := null;
  end if;
  return new;
end $$;
create trigger cart_items_live_guard before insert or update of live_id, product_id on public.cart_items
  for each row execute function private.cart_live_guard();

-- O checkout cria o pedido antes de esvaziar o carrinho: o pedido herda a live mais recente daquela loja
create function private.order_live_attribution() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.live_id is null then
    select c.live_id into new.live_id
    from public.cart_items c join public.products p on p.id = c.product_id
    where c.user_id = new.buyer_id and p.store_id = new.store_id and c.live_id is not null
    order by c.added_at desc limit 1;
  end if;
  return new;
end $$;
create trigger orders_live_attribution before insert on public.orders
  for each row execute function private.order_live_attribution();

revoke execute on function private.cart_live_guard(), private.order_live_attribution() from public, anon, authenticated;
