-- Fase 7: LIVELANCE LIVE (transmissões de venda)
-- Live = programação + produtos + chat em tempo real + leilão relâmpago com o motor de lances existente.
-- O vídeo vem de um serviço de transmissão (HLS); aqui fica só o link de reprodução.

create type public.live_status as enum ('scheduled', 'live', 'ended', 'cancelled');

create table public.lives (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 1000),
  status public.live_status not null default 'scheduled',
  scheduled_at timestamptz not null,
  started_at timestamptz,
  ended_at timestamptz,
  playback_url text check (playback_url ~ '^https://[^\s]+$' and char_length(playback_url) <= 500),
  pinned_product_id uuid references public.products (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lives_status_idx on public.lives (status, scheduled_at);
create index lives_store_idx on public.lives (store_id, scheduled_at desc);

create table public.live_products (
  live_id uuid not null references public.lives (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  position integer not null default 0,
  primary key (live_id, product_id)
);
create index live_products_product_idx on public.live_products (product_id);

create table public.live_messages (
  id bigint generated always as identity primary key,
  live_id uuid not null references public.lives (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  alias text not null,
  body text not null check (char_length(body) between 1 and 200),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index live_messages_live_idx on public.live_messages (live_id, id desc);
create index live_messages_user_idx on public.live_messages (user_id, created_at desc);

-- Leilão relâmpago aberto durante a live
alter table public.auctions add column live_id uuid references public.lives (id) on delete set null;
create index auctions_live_idx on public.auctions (live_id) where live_id is not null;

create trigger lives_set_updated_at before update on public.lives for each row execute function private.set_updated_at();

alter table public.lives enable row level security;
alter table public.live_products enable row level security;
alter table public.live_messages enable row level security;

create policy "lives: públicas ou da própria loja" on public.lives for select to anon, authenticated
  using (
    (status <> 'cancelled' and exists (select 1 from public.stores s where s.id = store_id and s.is_active))
    or store_id = (select private.my_store_id())
  );
create policy "produtos da live: como a live" on public.live_products for select to anon, authenticated
  using (exists (select 1 from public.lives l where l.id = live_id));
create policy "chat: mensagens visíveis da live" on public.live_messages for select to anon, authenticated
  using (
    exists (select 1 from public.lives l where l.id = live_id)
    and (not hidden or exists (select 1 from public.lives l where l.id = live_id and l.store_id = (select private.my_store_id())))
  );

revoke insert, update, delete, truncate on public.lives, public.live_products, public.live_messages from anon, authenticated;

alter publication supabase_realtime add table public.lives, public.live_messages;

update public.feature_flags set enabled = true, description = 'LIVELANCE LIVE — liberado na Fase 7' where key = 'live';

-- Loja dona da live (ou erro)
create function private.my_live(_live_id uuid) returns public.lives
language plpgsql stable security definer set search_path = '' as $$
declare _l public.lives;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into _l from public.lives where id = _live_id and store_id = private.my_store_id();
  if _l.id is null then raise exception 'live_not_found' using errcode = 'P0001'; end if;
  return _l;
end $$;

create function public.create_live(_title text, _description text, _scheduled_at timestamptz, _product_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  _store uuid := private.my_store_id();
  _id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if _store is null then raise exception 'store_required' using errcode = 'P0001'; end if;
  if _scheduled_at is null or _scheduled_at < now() - interval '5 minutes' or _scheduled_at > now() + interval '60 days' then
    raise exception 'invalid_schedule' using errcode = 'P0001';
  end if;
  if coalesce(cardinality(_product_ids), 0) = 0 or cardinality(_product_ids) > 30 then
    raise exception 'products_required' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(_product_ids) pid where not exists (
    select 1 from public.products p where p.id = pid and p.store_id = _store and p.status = 'active')) then
    raise exception 'product_not_found' using errcode = 'P0001';
  end if;
  insert into public.lives (store_id, title, description, scheduled_at)
  values (_store, btrim(_title), nullif(btrim(_description), ''), _scheduled_at)
  returning id into _id;
  insert into public.live_products (live_id, product_id, position)
  select _id, pid, ord::integer from unnest(_product_ids) with ordinality as t(pid, ord)
  on conflict do nothing;
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (auth.uid(), 'live.create', 'live', _id::text);
  return _id;
end $$;

-- Link de reprodução HLS do serviço de transmissão
create function public.set_live_playback(_live_id uuid, _url text) returns void
language plpgsql security definer set search_path = '' as $$
declare _l public.lives := private.my_live(_live_id);
begin
  if _url is not null and (_url !~ '^https://[^\s]+$' or char_length(_url) > 500) then
    raise exception 'invalid_url' using errcode = 'P0001';
  end if;
  update public.lives set playback_url = nullif(btrim(_url), '') where id = _l.id;
end $$;

create function public.start_live(_live_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare _l public.lives := private.my_live(_live_id);
begin
  if _l.status <> 'scheduled' then raise exception 'live_not_scheduled' using errcode = 'P0001'; end if;
  update public.lives set status = 'live', started_at = now() where id = _l.id;
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (auth.uid(), 'live.start', 'live', _l.id::text);
end $$;

create function public.end_live(_live_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare _l public.lives := private.my_live(_live_id);
begin
  if _l.status = 'live' then
    update public.lives set status = 'ended', ended_at = now(), pinned_product_id = null where id = _l.id;
  elsif _l.status = 'scheduled' then
    update public.lives set status = 'cancelled', ended_at = now() where id = _l.id;
  else
    raise exception 'live_finished' using errcode = 'P0001';
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (auth.uid(), 'live.end', 'live', _l.id::text);
end $$;

-- Produto em destaque (só produto da live; null tira o destaque)
create function public.pin_live_product(_live_id uuid, _product_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare _l public.lives := private.my_live(_live_id);
begin
  if _l.status <> 'live' then raise exception 'live_not_live' using errcode = 'P0001'; end if;
  if _product_id is not null and not exists (select 1 from public.live_products where live_id = _l.id and product_id = _product_id) then
    raise exception 'product_not_in_live' using errcode = 'P0001';
  end if;
  update public.lives set pinned_product_id = _product_id where id = _l.id;
end $$;

-- Leilão relâmpago: usa create_auction (reserva estoque, regras de lance) e liga à live
create function public.start_live_auction(_live_id uuid, _product_id uuid, _starting_cents integer, _increment_cents integer, _minutes integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  _l public.lives := private.my_live(_live_id);
  _id uuid;
begin
  if _l.status <> 'live' then raise exception 'live_not_live' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.live_products where live_id = _l.id and product_id = _product_id) then
    raise exception 'product_not_in_live' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.auctions where live_id = _l.id and status = 'active') then
    raise exception 'live_auction_running' using errcode = 'P0001';
  end if;
  _id := public.create_auction(_product_id, _starting_cents, _increment_cents, null, null, _minutes);
  update public.auctions set live_id = _l.id where id = _id;
  update public.lives set pinned_product_id = _product_id where id = _l.id;
  return _id;
end $$;

-- Chat: só com a live no ar, uma mensagem a cada 2 s por pessoa
create function public.send_live_message(_live_id uuid, _body text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _text text := btrim(regexp_replace(coalesce(_body, ''), '\s+', ' ', 'g'));
  _alias text;
  _id bigint;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.lives where id = _live_id and status = 'live') then
    raise exception 'live_not_live' using errcode = 'P0001';
  end if;
  if char_length(_text) = 0 or char_length(_text) > 200 then raise exception 'invalid_message' using errcode = 'P0001'; end if;
  if exists (select 1 from public.live_messages where user_id = _uid and created_at > now() - interval '2 seconds') then
    raise exception 'too_fast' using errcode = 'P0001';
  end if;
  select split_part(btrim(display_name), ' ', 1)
         || coalesce(' ' || nullif(left(split_part(btrim(display_name), ' ', 2), 1), '') || '.', '')
  into _alias from public.profiles where id = _uid;
  insert into public.live_messages (live_id, user_id, alias, body)
  values (_live_id, _uid, coalesce(nullif(_alias, ''), 'Visitante'), _text)
  returning id into _id;
  return _id;
end $$;

-- Moderação: a loja esconde mensagens da própria live
create function public.hide_live_message(_message_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare _n integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.live_messages m set hidden = true
  from public.lives l
  where m.id = _message_id and l.id = m.live_id and l.store_id = private.my_store_id();
  get diagnostics _n = row_count;
  if _n = 0 then raise exception 'message_not_found' using errcode = 'P0001'; end if;
end $$;

revoke execute on function private.my_live(uuid) from public, anon, authenticated;
revoke execute on function public.create_live(text, text, timestamptz, uuid[]), public.set_live_playback(uuid, text),
  public.start_live(uuid), public.end_live(uuid), public.pin_live_product(uuid, uuid),
  public.start_live_auction(uuid, uuid, integer, integer, integer), public.send_live_message(uuid, text),
  public.hide_live_message(bigint) from public, anon;
grant execute on function public.create_live(text, text, timestamptz, uuid[]), public.set_live_playback(uuid, text),
  public.start_live(uuid), public.end_live(uuid), public.pin_live_product(uuid, uuid),
  public.start_live_auction(uuid, uuid, integer, integer, integer), public.send_live_message(uuid, text),
  public.hide_live_message(bigint) to authenticated;
