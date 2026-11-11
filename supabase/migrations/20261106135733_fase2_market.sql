-- LIVELANCE · Fase 2 · MARKET + SELLER
-- Lojas, categorias, produtos, fotos, carrinho, pedidos e movimentação de estoque.
-- Regras críticas (fechar pedido, cancelar, criar loja) em funções transacionais no banco.

create type public.product_condition as enum ('new', 'used', 'refurbished');
create type public.product_status as enum ('draft', 'active', 'paused');
create type public.order_status as enum ('pending_payment', 'paid', 'shipped', 'delivered', 'cancelled');

-- Lojas: uma por vendedor nesta fase
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete restrict,
  name text not null check (char_length(name) between 3 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$'),
  description text check (char_length(description) <= 600),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id smallint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  position smallint not null default 0
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  category_id smallint references public.categories (id),
  title text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 5000),
  condition public.product_condition not null default 'new',
  price_cents integer not null check (price_cents between 100 and 100000000),
  compare_at_cents integer check (compare_at_cents is null or compare_at_cents > price_cents),
  stock integer not null default 0 check (stock >= 0),
  status public.product_status not null default 'draft',
  search tsvector generated always as (
    setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(description, '')), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_store_idx on public.products (store_id);
create index products_category_idx on public.products (category_id) where status = 'active';
create index products_search_idx on public.products using gin (search);
create index products_created_idx on public.products (created_at desc) where status = 'active';

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, position);

create table public.cart_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 99),
  added_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  buyer_id uuid not null references auth.users (id) on delete restrict,
  store_id uuid not null references public.stores (id) on delete restrict,
  status public.order_status not null default 'pending_payment',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  total_cents integer not null check (total_cents = subtotal_cents + shipping_cents),
  shipping_address jsonb not null,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_store_idx on public.orders (store_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  title text not null,
  unit_price_cents integer not null check (unit_price_cents > 0),
  quantity integer not null check (quantity > 0)
);
create index order_items_order_idx on public.order_items (order_id);

-- Histórico de estoque: só inserção
create table public.inventory_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('manual', 'order', 'order_cancelled')),
  order_id uuid references public.orders (id),
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index inventory_movements_product_idx on public.inventory_movements (product_id, created_at desc);

create trigger stores_set_updated_at before update on public.stores for each row execute function private.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function private.set_updated_at();
create trigger orders_set_updated_at before update on public.orders for each row execute function private.set_updated_at();

-- Toda mudança de estoque vira movimento (motivo vem de app.stock_reason, padrão 'manual')
create function private.log_stock_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.stock is distinct from old.stock then
    insert into public.inventory_movements (product_id, delta, reason, order_id, actor_id)
    values (
      new.id,
      new.stock - old.stock,
      coalesce(nullif(current_setting('app.stock_reason', true), ''), 'manual'),
      nullif(current_setting('app.stock_order', true), '')::uuid,
      (select auth.uid())
    );
  end if;
  return new;
end $$;
create trigger products_log_stock after update of stock on public.products
for each row execute function private.log_stock_change();
revoke execute on function private.log_stock_change() from public, anon, authenticated;

-- Dono da loja (usado nas políticas)
create function private.my_store_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.stores where owner_id = (select auth.uid());
$$;
revoke execute on function private.my_store_id() from public, anon;
grant execute on function private.my_store_id() to authenticated;

-- RLS
alter table public.stores enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_movements enable row level security;

create policy "lojas: ativas são públicas; dono vê a sua" on public.stores for select to anon, authenticated
  using (is_active or owner_id = (select auth.uid()));
create policy "lojas: dono edita" on public.stores for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
revoke update on public.stores from authenticated;
grant update (name, description) on public.stores to authenticated;

create policy "categorias: públicas" on public.categories for select to anon, authenticated using (true);

create policy "produtos: ativos de lojas ativas são públicos; dono vê os seus" on public.products for select to anon, authenticated
  using (
    (status = 'active' and exists (select 1 from public.stores s where s.id = store_id and s.is_active))
    or store_id = (select private.my_store_id())
  );
create policy "produtos: dono cria" on public.products for insert to authenticated
  with check (store_id = (select private.my_store_id()));
create policy "produtos: dono edita" on public.products for update to authenticated
  using (store_id = (select private.my_store_id())) with check (store_id = (select private.my_store_id()));
revoke update on public.products from authenticated;
grant update (category_id, title, description, condition, price_cents, compare_at_cents, stock, status) on public.products to authenticated;

create policy "fotos: visíveis com o produto" on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id));
create policy "fotos: dono cria" on public.product_images for insert to authenticated
  with check (exists (select 1 from public.products p where p.id = product_id and p.store_id = (select private.my_store_id())));
create policy "fotos: dono apaga" on public.product_images for delete to authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.store_id = (select private.my_store_id())));

create policy "carrinho: dono lê" on public.cart_items for select to authenticated using (user_id = (select auth.uid()));
create policy "carrinho: dono adiciona" on public.cart_items for insert to authenticated with check (user_id = (select auth.uid()));
create policy "carrinho: dono altera" on public.cart_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "carrinho: dono remove" on public.cart_items for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.cart_items from authenticated;
grant update (quantity) on public.cart_items to authenticated;

create policy "pedidos: comprador ou loja leem" on public.orders for select to authenticated
  using (buyer_id = (select auth.uid()) or store_id = (select private.my_store_id()));
create policy "itens: comprador ou loja leem" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
    and (o.buyer_id = (select auth.uid()) or o.store_id = (select private.my_store_id()))));
-- Pedidos e itens: sem escrita direta. Só pelas funções abaixo.

create policy "estoque: dono lê o histórico" on public.inventory_movements for select to authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.store_id = (select private.my_store_id())));

-- Criar loja: insere a loja e concede o papel de vendedor
create function public.create_store(_name text, _slug text, _description text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _id uuid;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if exists (select 1 from public.stores where owner_id = _uid) then
    raise exception 'store_exists' using errcode = 'P0001';
  end if;
  insert into public.stores (owner_id, name, slug, description)
  values (_uid, trim(_name), lower(trim(_slug)), nullif(trim(_description), ''))
  returning id into _id;
  insert into public.user_roles (user_id, role) values (_uid, 'seller') on conflict do nothing;
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (_uid, 'store.create', 'store', _id::text);
  return _id;
end $$;
revoke execute on function public.create_store(text, text, text) from public, anon;
grant execute on function public.create_store(text, text, text) to authenticated;

-- Fechar pedido: trava os produtos, confere estoque, cria um pedido por loja, baixa estoque e esvazia o carrinho.
create function public.checkout(_address_id uuid)
returns uuid[] language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _addr jsonb;
  _store record;
  _order_id uuid;
  _orders uuid[] := '{}';
  _item record;
  _subtotal integer;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select to_jsonb(a) - 'user_id' - 'created_at' - 'is_default' into _addr
  from public.addresses a where a.id = _address_id and a.user_id = _uid;
  if _addr is null then raise exception 'address_not_found' using errcode = 'P0001'; end if;

  if not exists (select 1 from public.cart_items where user_id = _uid) then
    raise exception 'cart_empty' using errcode = 'P0001';
  end if;

  -- Trava as linhas dos produtos do carrinho (ordem fixa evita deadlock)
  perform 1 from public.products p
  where p.id in (select product_id from public.cart_items where user_id = _uid)
  order by p.id for update;

  -- Confere disponibilidade de tudo antes de gravar qualquer coisa
  for _item in
    select c.product_id, c.quantity, p.stock, p.status, p.title, s.is_active, s.owner_id
    from public.cart_items c
    join public.products p on p.id = c.product_id
    join public.stores s on s.id = p.store_id
    where c.user_id = _uid
  loop
    if _item.status <> 'active' or not _item.is_active then
      raise exception 'product_unavailable:%', _item.title using errcode = 'P0001';
    end if;
    if _item.owner_id = _uid then
      raise exception 'own_product:%', _item.title using errcode = 'P0001';
    end if;
    if _item.stock < _item.quantity then
      raise exception 'insufficient_stock:%', _item.title using errcode = 'P0001';
    end if;
  end loop;

  perform set_config('app.stock_reason', 'order', true);

  for _store in
    select distinct p.store_id from public.cart_items c join public.products p on p.id = c.product_id where c.user_id = _uid
  loop
    select coalesce(sum(p.price_cents * c.quantity), 0)::integer into _subtotal
    from public.cart_items c join public.products p on p.id = c.product_id
    where c.user_id = _uid and p.store_id = _store.store_id;

    insert into public.orders (buyer_id, store_id, subtotal_cents, shipping_cents, total_cents, shipping_address)
    values (_uid, _store.store_id, _subtotal, 0, _subtotal, _addr)
    returning id into _order_id;
    _orders := _orders || _order_id;

    insert into public.order_items (order_id, product_id, title, unit_price_cents, quantity)
    select _order_id, p.id, p.title, p.price_cents, c.quantity
    from public.cart_items c join public.products p on p.id = c.product_id
    where c.user_id = _uid and p.store_id = _store.store_id;

    perform set_config('app.stock_order', _order_id::text, true);
    update public.products p set stock = p.stock - c.quantity
    from public.cart_items c
    where c.user_id = _uid and c.product_id = p.id and p.store_id = _store.store_id;

    insert into public.audit_logs (actor_id, action, entity, entity_id, data)
    values (_uid, 'order.create', 'order', _order_id::text, jsonb_build_object('total_cents', _subtotal));
  end loop;

  perform set_config('app.stock_reason', '', true);
  perform set_config('app.stock_order', '', true);
  delete from public.cart_items where user_id = _uid;
  return _orders;
end $$;
revoke execute on function public.checkout(uuid) from public, anon;
grant execute on function public.checkout(uuid) to authenticated;

-- Cancelar pedido aguardando pagamento (comprador ou loja). Devolve o estoque.
create function public.cancel_order(_order_id uuid, _reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _o record;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select o.*, s.owner_id into _o from public.orders o join public.stores s on s.id = o.store_id
  where o.id = _order_id for update of o;
  if _o.id is null or (_o.buyer_id <> _uid and _o.owner_id <> _uid) then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if _o.status <> 'pending_payment' then
    raise exception 'order_not_cancellable' using errcode = 'P0001';
  end if;

  perform set_config('app.stock_reason', 'order_cancelled', true);
  perform set_config('app.stock_order', _order_id::text, true);
  update public.products p set stock = p.stock + i.quantity
  from public.order_items i where i.order_id = _order_id and i.product_id = p.id;
  perform set_config('app.stock_reason', '', true);
  perform set_config('app.stock_order', '', true);

  update public.orders set status = 'cancelled', cancelled_reason = left(coalesce(_reason,
    case when _o.buyer_id = _uid then 'Cancelado pelo comprador' else 'Cancelado pela loja' end), 200)
  where id = _order_id;
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (_uid, 'order.cancel', 'order', _order_id::text);
end $$;
revoke execute on function public.cancel_order(uuid, text) from public, anon;
grant execute on function public.cancel_order(uuid, text) to authenticated;

-- Fotos dos produtos: bucket público para leitura; escrita só na pasta da própria loja
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "fotos: dono envia na pasta da loja" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select private.my_store_id())::text);
create policy "fotos: dono apaga da pasta da loja" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select private.my_store_id())::text);

insert into public.categories (slug, name, position) values
  ('eletronicos', 'Eletrônicos', 1), ('celulares', 'Celulares', 2), ('informatica', 'Informática', 3),
  ('casa', 'Casa', 4), ('moda', 'Moda', 5), ('beleza', 'Beleza', 6), ('esportes', 'Esportes', 7),
  ('automotivo', 'Automotivo', 8), ('ferramentas', 'Ferramentas', 9), ('brinquedos', 'Brinquedos', 10),
  ('livros', 'Livros', 11), ('colecionaveis', 'Colecionáveis', 12);

insert into public.feature_flags (key, enabled, description) values
  ('market', true, 'LIVELANCE MARKET — catálogo, carrinho e pedidos (sem pagamento real até a Fase 4)')
on conflict (key) do nothing;
