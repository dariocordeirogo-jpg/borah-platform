-- Ponte com TikTok e Instagram: comentários da live na rede social viram lances e itens no carrinho da Zexi,
-- mas só para quem vinculou a conta Zexi ao @ (código de uso único comentado na live pelo próprio @).
-- O conector (fora da Vercel) só repassa comentários assinados; quem decide é o banco, com as mesmas regras do site.
-- Nada fica guardado depois: quando a live termina, o espelho dos comentários da rede social é apagado.

-- @ vinculado à conta Zexi (um @ por rede em cada conta, uma conta por @)
create table public.social_links (
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'instagram')),
  username text not null check (username ~ '^[a-z0-9._]{1,30}$'),
  linked_at timestamptz not null default now(),
  primary key (user_id, platform),
  unique (platform, username)
);
alter table public.social_links enable row level security;
create policy "social: dono vê os próprios vínculos" on public.social_links for select to authenticated using (user_id = auth.uid());

-- Códigos de vínculo (valem 30 minutos, uso único; servem para qualquer rede)
create table public.social_link_codes (
  code text primary key check (code ~ '^ZX[0-9]{6}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index social_link_codes_user_idx on public.social_link_codes (user_id);
alter table public.social_link_codes enable row level security;
create policy "social: dono vê os próprios códigos" on public.social_link_codes for select to authenticated using (user_id = auth.uid());

-- Live ligada aos perfis da loja nas redes
alter table public.lives
  add column tiktok_username text check (tiktok_username ~ '^[a-z0-9._]{1,30}$'),
  add column instagram_username text check (instagram_username ~ '^[a-z0-9._]{1,30}$');

-- Espelho, durante a live, dos comentários da rede social e do resultado de cada comando
create table public.live_social_events (
  id bigint generated always as identity primary key,
  live_id uuid not null references public.lives (id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'instagram')),
  msg_id text not null,
  username text not null,
  nickname text not null,
  body text not null,
  kind text not null check (kind in ('comment', 'link', 'bid', 'want')),
  result text,
  created_at timestamptz not null default now(),
  unique (live_id, platform, msg_id)
);
create index live_social_events_live_idx on public.live_social_events (live_id, id desc);
alter table public.live_social_events enable row level security;
create policy "social: espelho visível com a live no ar" on public.live_social_events for select to anon, authenticated
  using (exists (select 1 from public.lives l where l.id = live_id and l.status = 'live'));
alter publication supabase_realtime add table public.live_social_events;

-- Acabou a live: apaga o espelho dos comentários (nada fica gravado)
create function private.live_social_purge() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('ended', 'cancelled') and old.status is distinct from new.status then
    delete from public.live_social_events where live_id = new.id;
  end if;
  return new;
end $$;
create trigger lives_social_purge after update of status on public.lives
  for each row execute function private.live_social_purge();

-- Assinatura do conector: hmac-sha256(payload) com o segredo do Vault; o payload traz "ts" (até 5 min)
create function private.social_bridge_ok(_payload text, _signature text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  _secret text;
  _p jsonb;
begin
  select decrypted_secret into _secret from vault.decrypted_secrets where name = 'social_bridge_secret' limit 1;
  if _secret is null or length(_secret) < 32 then raise exception 'bridge_not_configured' using errcode = 'P0001'; end if;
  if _signature is null or lower(_signature) <> encode(extensions.hmac(convert_to(_payload, 'UTF8'), convert_to(_secret, 'UTF8'), 'sha256'), 'hex') then
    raise exception 'bad_signature' using errcode = '28000';
  end if;
  _p := _payload::jsonb;
  if abs(extract(epoch from now()) - coalesce((_p->>'ts')::numeric / 1000, 0)) > 300 then
    raise exception 'stale_payload' using errcode = '28000';
  end if;
  return _p;
end $$;

-- Lance: o mesmo motor do site, com o comprador explícito (site usa auth.uid(), redes sociais usam o vínculo)
create function private.place_bid_as(_uid uuid, _auction_id uuid, _amount_cents integer, _idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  _a record;
  _blocker text;
  _min integer;
  _extended boolean := false;
  _new_end timestamptz;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select a.*, s.owner_id into _a from public.auctions a join public.stores s on s.id = a.store_id
  where a.id = _auction_id for update of a;
  if _a.id is null then raise exception 'auction_not_found' using errcode = 'P0001'; end if;

  if exists (select 1 from public.auction_bids where auction_id = _auction_id and bidder_id = _uid and idempotency_key = _idempotency_key) then
    return jsonb_build_object('duplicate', true, 'current_price_cents', _a.current_price_cents, 'ends_at', _a.ends_at, 'bids_count', _a.bids_count);
  end if;

  _blocker := private.bid_blocker(_uid, _a.lineage_id);
  if _blocker is not null then raise exception '%', _blocker using errcode = 'P0001'; end if;
  if _a.owner_id = _uid then raise exception 'own_auction' using errcode = 'P0001'; end if;
  if _a.status <> 'active' or now() >= _a.ends_at then raise exception 'auction_closed' using errcode = 'P0001'; end if;
  if now() < _a.starts_at then raise exception 'auction_not_started' using errcode = 'P0001'; end if;
  if _a.leader_id = _uid then raise exception 'already_leading' using errcode = 'P0001'; end if;

  _min := coalesce(_a.current_price_cents + _a.min_increment_cents, _a.starting_price_cents);
  if _amount_cents is null or _amount_cents < _min then
    raise exception 'bid_too_low:%', _min using errcode = 'P0001';
  end if;
  if _amount_cents > greatest(_min * 20, _min + 1000000) then
    raise exception 'bid_too_high:%', _min using errcode = 'P0001';
  end if;

  _new_end := _a.ends_at;
  if _a.ends_at - now() < make_interval(secs => _a.snipe_window_s) and _a.extensions_count < _a.max_extensions then
    _new_end := now() + make_interval(secs => _a.snipe_extend_s);
    _extended := true;
  end if;

  insert into public.auction_bids (auction_id, bidder_id, bidder_alias, amount_cents, idempotency_key)
  values (_auction_id, _uid, coalesce(private.alias_for(_uid), 'Comprador'), _amount_cents, _idempotency_key);

  update public.auctions set
    current_price_cents = _amount_cents,
    leader_id = _uid,
    leader_alias = coalesce(private.alias_for(_uid), 'Comprador'),
    bids_count = bids_count + 1,
    ends_at = _new_end,
    extensions_count = extensions_count + case when _extended then 1 else 0 end
  where id = _auction_id;

  perform private.log_auction(_auction_id, 'bid', jsonb_build_object('amount_cents', _amount_cents, 'extended', _extended));
  return jsonb_build_object('duplicate', false, 'current_price_cents', _amount_cents, 'ends_at', _new_end,
    'bids_count', _a.bids_count + 1, 'extended', _extended);
end $$;

-- O lance do site passa a usar o mesmo motor (mesmo comportamento de antes)
create or replace function public.place_bid(_auction_id uuid, _amount_cents integer, _idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return private.place_bid_as(auth.uid(), _auction_id, _amount_cents, _idempotency_key);
end $$;

-- Código de vínculo para a conta logada (troca o anterior que ainda não foi usado)
create function public.start_social_link() returns text
language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _code text;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if (select count(*) from public.social_link_codes where user_id = _uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too_many_codes' using errcode = 'P0001';
  end if;
  delete from public.social_link_codes where user_id = _uid and used_at is null;
  loop
    _code := 'ZX' || lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.social_link_codes where code = _code);
  end loop;
  insert into public.social_link_codes (code, user_id, expires_at) values (_code, _uid, now() + interval '30 minutes');
  return _code;
end $$;

create function public.unlink_social(_platform text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  delete from public.social_links where user_id = auth.uid() and platform = _platform;
end $$;

-- Loja liga (ou desliga, com vazio) a live ao seu perfil numa rede
create function public.set_live_social(_live_id uuid, _platform text, _username text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  _l public.lives := private.my_live(_live_id);
  _u text := nullif(lower(btrim(coalesce(_username, ''), '@ ')), '');
begin
  if _l.status not in ('scheduled', 'live') then raise exception 'live_finished' using errcode = 'P0001'; end if;
  if _u is not null and _u !~ '^[a-z0-9._]{1,30}$' then raise exception 'invalid_social_username' using errcode = 'P0001'; end if;
  if _platform = 'tiktok' then update public.lives set tiktok_username = _u where id = _l.id;
  elsif _platform = 'instagram' then update public.lives set instagram_username = _u where id = _l.id;
  else raise exception 'invalid_platform' using errcode = 'P0001';
  end if;
end $$;

-- Conector: quais lives estão no ar com perfil em alguma rede
create function public.social_bridge_targets(_payload text, _signature text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.social_bridge_ok(_payload, _signature);
  return coalesce((
    select jsonb_agg(t) from (
      select jsonb_build_object('live_id', id, 'platform', 'tiktok', 'username', tiktok_username) as t
      from public.lives where status = 'live' and tiktok_username is not null
      union all
      select jsonb_build_object('live_id', id, 'platform', 'instagram', 'username', instagram_username)
      from public.lives where status = 'live' and instagram_username is not null
    ) x), '[]'::jsonb);
end $$;

-- Conector: um comentário da rede social. Espelha na live e executa o comando, se houver.
create function public.social_bridge_comment(_payload text, _signature text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _p jsonb := private.social_bridge_ok(_payload, _signature);
  _platform text := _p->>'platform';
  _live record;
  _user text := lower(btrim(coalesce(_p->>'username', ''), '@ '));
  _nick text := left(coalesce(nullif(btrim(_p->>'nickname'), ''), _p->>'username', ''), 60);
  _text text := left(btrim(coalesce(_p->>'text', '')), 200);
  _msg text := left(coalesce(_p->>'msg_id', ''), 80);
  _up text;
  _kind text := 'comment';
  _result text;
  _uid uuid;
  _code record;
  _m text[];
  _cents integer;
  _auction uuid;
  _prod record;
begin
  if _platform not in ('tiktok', 'instagram') or _user !~ '^[a-z0-9._]{1,30}$' or _text = '' or _msg = '' then
    return jsonb_build_object('result', 'ignored');
  end if;
  select id, status, pinned_product_id, tiktok_username, instagram_username into _live
  from public.lives where id = (_p->>'live_id')::uuid;
  if _live.id is null or _live.status <> 'live' then return jsonb_build_object('result', 'live_not_live'); end if;
  -- Só aceita comentários do perfil que a loja ligou a esta live
  if (_platform = 'tiktok' and _live.tiktok_username is null) or (_platform = 'instagram' and _live.instagram_username is null) then
    return jsonb_build_object('result', 'platform_not_linked');
  end if;
  if exists (select 1 from public.live_social_events where live_id = _live.id and platform = _platform and msg_id = _msg) then
    return jsonb_build_object('result', 'duplicate');
  end if;

  _up := upper(_text);
  select user_id into _uid from public.social_links where platform = _platform and username = _user;

  if _up ~ '^ZX[0-9]{6}$' then
    -- Vínculo: só quem controla o @ consegue comentar o código com ele
    _kind := 'link';
    select * into _code from public.social_link_codes where code = _up for update;
    if _code.code is null or _code.used_at is not null or _code.expires_at < now() then
      _result := 'invalid_code';
    else
      delete from public.social_links where platform = _platform and (username = _user or user_id = _code.user_id);
      insert into public.social_links (user_id, platform, username) values (_code.user_id, _platform, _user);
      update public.social_link_codes set used_at = now() where code = _code.code;
      _result := 'linked';
    end if;
    _text := 'Código de vínculo';
  elsif _up ~ '^LANCE\s*(R\$\s*)?[0-9]' then
    _kind := 'bid';
    _m := regexp_match(_up, '^LANCE\s*(?:R\$\s*)?([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{1,7})(?:,([0-9]{1,2}))?\s*$');
    select id into _auction from public.auctions where live_id = _live.id and status = 'active' order by starts_at desc limit 1;
    if _m is null then _result := 'invalid_amount';
    elsif _auction is null then _result := 'no_auction';
    elsif _uid is null then _result := 'not_linked';
    else
      _cents := replace(_m[1], '.', '')::integer * 100 + coalesce(rpad(_m[2], 2, '0')::integer, 0);
      begin
        perform private.place_bid_as(_uid, _auction, _cents, _platform || ':' || _msg);
        _result := 'ok';
      exception when sqlstate 'P0001' or sqlstate '28000' then
        _result := split_part(sqlerrm, ':', 1);
      end;
    end if;
  elsif _up ~ '^(EU\s+QUERO|QUERO|COMPRAR)\M' then
    _kind := 'want';
    select p.id, p.status, p.stock, p.is_showcase, s.owner_id into _prod
    from public.products p join public.stores s on s.id = p.store_id where p.id = _live.pinned_product_id;
    if _prod.id is null then _result := 'no_product';
    elsif exists (select 1 from public.auctions where live_id = _live.id and status = 'active') then _result := 'auction_running';
    elsif _uid is null then _result := 'not_linked';
    elsif _prod.owner_id = _uid then _result := 'own_product';
    elsif _prod.status <> 'active' or _prod.stock < 1 or _prod.is_showcase then _result := 'out_of_stock';
    else
      -- Vai para o carrinho, marcado com a live; estoque e preço são conferidos de novo ao fechar o pedido
      insert into public.cart_items (user_id, product_id, quantity, live_id) values (_uid, _prod.id, 1, _live.id)
      on conflict (user_id, product_id) do update set live_id = excluded.live_id;
      _result := 'in_cart';
    end if;
  end if;

  insert into public.live_social_events (live_id, platform, msg_id, username, nickname, body, kind, result)
  values (_live.id, _platform, _msg, _user, coalesce(nullif(_nick, ''), _user), _text, _kind, _result);
  return jsonb_build_object('result', coalesce(_result, 'comment'));
end $$;

-- Só as funções acima escrevem nessas tabelas
revoke insert, update, delete on public.social_links, public.social_link_codes, public.live_social_events from anon, authenticated;

revoke execute on function public.start_social_link(), public.unlink_social(text), public.set_live_social(uuid, text, text) from public, anon;
grant execute on function public.start_social_link(), public.unlink_social(text), public.set_live_social(uuid, text, text) to authenticated;
revoke execute on function public.social_bridge_targets(text, text), public.social_bridge_comment(text, text) from public;
grant execute on function public.social_bridge_targets(text, text), public.social_bridge_comment(text, text) to anon, authenticated;
revoke execute on function private.place_bid_as(uuid, uuid, integer, text), private.social_bridge_ok(text, text),
  private.live_social_purge() from public, anon, authenticated;
