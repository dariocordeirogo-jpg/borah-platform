-- Fase 6: Vídeos curtos com produto marcado (feed vertical)
-- Upload direto do navegador para o Storage (pasta da própria loja); o registro do vídeo só passa
-- pela função create_video, que confere loja, produto e caminho do arquivo.

create type public.video_status as enum ('published', 'removed');

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null unique,
  caption text check (char_length(caption) <= 300),
  status public.video_status not null default 'published',
  views_count integer not null default 0 check (views_count >= 0),
  likes_count integer not null default 0 check (likes_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index videos_feed_idx on public.videos (created_at desc) where status = 'published';
create index videos_store_idx on public.videos (store_id, created_at desc);
create index videos_product_idx on public.videos (product_id);

create table public.video_likes (
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);
create index video_likes_video_idx on public.video_likes (video_id);

create trigger videos_set_updated_at before update on public.videos for each row execute function private.set_updated_at();

alter table public.videos enable row level security;
alter table public.video_likes enable row level security;

-- Feed público: vídeo publicado de loja ativa com produto ativo. A loja vê todos os seus.
create policy "vídeos: públicos ou da própria loja" on public.videos for select to anon, authenticated
  using (
    (status = 'published'
      and exists (select 1 from public.stores s where s.id = store_id and s.is_active)
      and exists (select 1 from public.products p where p.id = product_id and p.status = 'active'))
    or store_id = (select private.my_store_id())
  );
create policy "curtidas: o próprio lê" on public.video_likes for select to authenticated using (user_id = (select auth.uid()));

revoke insert, update, delete, truncate on public.videos, public.video_likes from anon, authenticated;

update public.feature_flags set enabled = true, description = 'Vídeos curtos com produto marcado — liberado na Fase 6' where key = 'videos';

-- Bucket público de leitura; escrita só na pasta da própria loja (50 MB, mp4/webm/mov)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-videos', 'product-videos', true, 52428800, array['video/mp4', 'video/webm', 'video/quicktime']);

create policy "vídeos: dono envia na pasta da loja" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-videos' and (storage.foldername(name))[1] = (select private.my_store_id())::text);
create policy "vídeos: dono apaga da pasta da loja" on storage.objects for delete to authenticated
  using (bucket_id = 'product-videos' and (storage.foldername(name))[1] = (select private.my_store_id())::text);

-- Publica um vídeo já enviado: o arquivo tem de estar na pasta da loja e o produto tem de ser dela
create function public.create_video(_product_id uuid, _path text, _caption text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  _store uuid := private.my_store_id();
  _id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if _store is null then raise exception 'store_required' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.products where id = _product_id and store_id = _store) then
    raise exception 'product_not_found' using errcode = 'P0001';
  end if;
  if _path !~ ('^' || _store::text || '/[0-9a-f-]{36}\.(mp4|webm|mov)$') then
    raise exception 'invalid_path' using errcode = 'P0001';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'product-videos' and name = _path) then
    raise exception 'file_not_found' using errcode = 'P0001';
  end if;
  insert into public.videos (store_id, product_id, path, caption)
  values (_store, _product_id, _path, nullif(btrim(left(_caption, 300)), ''))
  returning id into _id;
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (auth.uid(), 'video.create', 'video', _id::text);
  return _id;
end $$;
revoke execute on function public.create_video(uuid, text, text) from public, anon;
grant execute on function public.create_video(uuid, text, text) to authenticated;

-- Loja tira o vídeo do ar (o arquivo é apagado pelo servidor em seguida)
create function public.remove_video(_video_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare _path text;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.videos set status = 'removed'
  where id = _video_id and store_id = private.my_store_id() and status = 'published'
  returning path into _path;
  if _path is null then raise exception 'video_not_found' using errcode = 'P0001'; end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (auth.uid(), 'video.remove', 'video', _video_id::text);
  return _path;
end $$;
revoke execute on function public.remove_video(uuid) from public, anon;
grant execute on function public.remove_video(uuid) to authenticated;

-- Curtir / descurtir (contador mantido aqui, numa transação)
create function public.toggle_video_like(_video_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _liked boolean;
  _count integer;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform 1 from public.videos where id = _video_id and status = 'published' for update;
  if not found then raise exception 'video_not_found' using errcode = 'P0001'; end if;
  delete from public.video_likes where user_id = _uid and video_id = _video_id;
  if found then
    _liked := false;
    update public.videos set likes_count = greatest(likes_count - 1, 0) where id = _video_id returning likes_count into _count;
  else
    insert into public.video_likes (user_id, video_id) values (_uid, _video_id);
    _liked := true;
    update public.videos set likes_count = likes_count + 1 where id = _video_id returning likes_count into _count;
  end if;
  return jsonb_build_object('liked', _liked, 'likes', _count);
end $$;
revoke execute on function public.toggle_video_like(uuid) from public, anon;
grant execute on function public.toggle_video_like(uuid) to authenticated;

-- Visualização (estatística simples; qualquer visitante)
create function public.register_video_view(_video_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.videos set views_count = views_count + 1 where id = _video_id and status = 'published'
$$;
revoke execute on function public.register_video_view(uuid) from public;
grant execute on function public.register_video_view(uuid) to anon, authenticated;
