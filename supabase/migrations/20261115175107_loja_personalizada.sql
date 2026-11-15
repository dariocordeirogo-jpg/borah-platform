-- Página da loja personalizável: logo, capa, cor, frase de apresentação, banners e produtos em destaque.
-- Textos passam pelo filtro de contato (ocultado automaticamente). Imagens ficam no bucket público store-media,
-- na pasta da própria loja. Contato e redes sociais continuam proibidos (também nas imagens: regra de uso + denúncia).

alter table public.stores
  add column logo_path text check (logo_path is null or logo_path like id::text || '/%'),
  add column cover_path text check (cover_path is null or cover_path like id::text || '/%'),
  add column theme text not null default 'laranja'
    check (theme in ('laranja', 'grafite', 'azul', 'verde', 'roxo', 'vermelho', 'rosa', 'turquesa')),
  add column tagline text check (tagline is null or char_length(tagline) <= 120);

grant update (logo_path, cover_path, theme, tagline) on public.stores to authenticated;

drop trigger stores_mask_contact on public.stores;
create trigger stores_mask_contact before insert or update of name, description, tagline on public.stores
  for each row execute function private.mask_contact_columns('name', 'description', 'tagline');

-- Banners da loja (até 5), opcionalmente levando a um produto da própria loja
create table public.store_banners (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  image_path text not null,
  title text check (title is null or char_length(title) <= 80),
  product_id uuid references public.products (id) on delete set null,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  check (image_path like store_id::text || '/%')
);
create index store_banners_store_idx on public.store_banners (store_id, position);
alter table public.store_banners enable row level security;
create policy "banners: todos veem os de lojas ativas" on public.store_banners for select to anon, authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.is_active));
create policy "banners: loja vê os seus" on public.store_banners for select to authenticated
  using (store_id = (select private.my_store_id()));
create policy "banners: loja cria os seus" on public.store_banners for insert to authenticated
  with check (store_id = (select private.my_store_id()));
create policy "banners: loja altera os seus" on public.store_banners for update to authenticated
  using (store_id = (select private.my_store_id())) with check (store_id = (select private.my_store_id()));
create policy "banners: loja apaga os seus" on public.store_banners for delete to authenticated
  using (store_id = (select private.my_store_id()));
grant select, insert, update, delete on public.store_banners to authenticated;
create trigger store_banners_mask_contact before insert or update of title on public.store_banners
  for each row execute function private.mask_contact_columns('title');

-- Produtos em destaque (até 12)
create table public.store_featured (
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  position smallint not null default 0,
  primary key (store_id, product_id)
);
alter table public.store_featured enable row level security;
create policy "destaques: todos veem" on public.store_featured for select to anon, authenticated using (true);
create policy "destaques: loja cria os seus" on public.store_featured for insert to authenticated
  with check (store_id = (select private.my_store_id()));
create policy "destaques: loja altera os seus" on public.store_featured for update to authenticated
  using (store_id = (select private.my_store_id())) with check (store_id = (select private.my_store_id()));
create policy "destaques: loja apaga os seus" on public.store_featured for delete to authenticated
  using (store_id = (select private.my_store_id()));
grant select, insert, update, delete on public.store_featured to authenticated;

-- Limites e produto da própria loja (banner e destaque)
create function private.check_store_media() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.product_id is not null and not exists (select 1 from public.products where id = new.product_id and store_id = new.store_id) then
    raise exception 'product_not_found' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    if tg_table_name = 'store_banners' and (select count(*) from public.store_banners where store_id = new.store_id) >= 5 then
      raise exception 'too_many_banners' using errcode = 'P0001';
    end if;
    if tg_table_name = 'store_featured' and (select count(*) from public.store_featured where store_id = new.store_id) >= 12 then
      raise exception 'too_many_featured' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger store_banners_check before insert or update on public.store_banners
  for each row execute function private.check_store_media();
create trigger store_featured_check before insert or update on public.store_featured
  for each row execute function private.check_store_media();
revoke execute on function private.check_store_media() from public, anon, authenticated;
revoke insert, update, delete on public.store_banners, public.store_featured from anon;

-- Imagens da loja: leitura pública; envio e remoção só na pasta da própria loja
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-media', 'store-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);
create policy "loja: dono envia na pasta da loja" on storage.objects for insert to authenticated
  with check (bucket_id = 'store-media' and (storage.foldername(name))[1] = (select private.my_store_id())::text);
create policy "loja: dono apaga da pasta da loja" on storage.objects for delete to authenticated
  using (bucket_id = 'store-media' and (storage.foldername(name))[1] = (select private.my_store_id())::text);
