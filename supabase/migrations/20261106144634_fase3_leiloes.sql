-- LIVELANCE · Fase 3 · LEILÕES
-- Verificação (CPF + telefone), leilões, lances, anti-sniping, encerramento agendado (pg_cron),
-- confirmação do arremate e regra de inadimplência (perde o lote; 3ª vez: 7 dias sem lances).

create extension if not exists pg_cron;

-- ---------- Verificação para dar lances ----------
create table public.user_verifications (
  user_id uuid primary key references auth.users (id) on delete cascade,
  cpf_hash text not null unique,
  cpf_masked text not null,
  phone text not null check (phone ~ '^\+55[1-9][0-9][0-9]{8,9}$'),
  phone_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger user_verifications_set_updated_at before update on public.user_verifications
for each row execute function private.set_updated_at();
alter table public.user_verifications enable row level security;
create policy "verificação: dono lê" on public.user_verifications for select to authenticated
  using (user_id = (select auth.uid()));

-- Dígitos verificadores do CPF
create function private.cpf_is_valid(_cpf text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  d int[];
  s int;
  r int;
  i int;
begin
  if _cpf !~ '^[0-9]{11}$' or _cpf ~ '^(.)\1{10}$' then return false; end if;
  d := array(select substr(_cpf, g, 1)::int from generate_series(1, 11) g);
  s := 0; for i in 1..9 loop s := s + d[i] * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> d[10] then return false; end if;
  s := 0; for i in 1..10 loop s := s + d[i] * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = d[11];
end $$;

create function public.submit_verification(_cpf text, _phone text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _digits text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  _phone_digits text := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
  _hash text;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not private.cpf_is_valid(_digits) then raise exception 'cpf_invalid' using errcode = 'P0001'; end if;
  if _phone_digits !~ '^[1-9][0-9][0-9]{8,9}$' then raise exception 'phone_invalid' using errcode = 'P0001'; end if;
  _hash := encode(extensions.digest('livelance:cpf:' || _digits, 'sha256'), 'hex');
  if exists (select 1 from public.user_verifications where cpf_hash = _hash and user_id <> _uid) then
    raise exception 'cpf_in_use' using errcode = 'P0001';
  end if;
  insert into public.user_verifications (user_id, cpf_hash, cpf_masked, phone)
  values (_uid, _hash, '***.' || substr(_digits, 4, 3) || '.' || substr(_digits, 7, 3) || '-**', '+55' || _phone_digits)
  on conflict (user_id) do update
    set cpf_hash = excluded.cpf_hash, cpf_masked = excluded.cpf_masked,
        phone = excluded.phone,
        phone_verified_at = case when public.user_verifications.phone = excluded.phone
                                 then public.user_verifications.phone_verified_at end;
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (_uid, 'verification.submit', 'user', _uid::text);
end $$;
revoke execute on function public.submit_verification(text, text) from public, anon;
grant execute on function public.submit_verification(text, text) to authenticated;

-- ---------- Leilões ----------
create type public.auction_status as enum ('active', 'ended', 'cancelled');

alter table public.inventory_movements drop constraint inventory_movements_reason_check;
alter table public.inventory_movements add constraint inventory_movements_reason_check
  check (reason in ('manual', 'order', 'order_cancelled', 'auction_reserved', 'auction_released'));

create table public.auctions (
  id uuid primary key default gen_random_uuid(),
  lineage_id uuid not null,
  relist_count smallint not null default 0,
  store_id uuid not null references public.stores (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  title text not null,
  starting_price_cents integer not null check (starting_price_cents between 100 and 100000000),
  min_increment_cents integer not null check (min_increment_cents between 100 and 10000000),
  reserve_price_cents integer check (reserve_price_cents is null or reserve_price_cents >= starting_price_cents),
  current_price_cents integer,
  leader_id uuid references auth.users (id),
  leader_alias text,
  bids_count integer not null default 0,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration interval not null,
  snipe_window_s integer not null default 120 check (snipe_window_s between 30 and 600),
  snipe_extend_s integer not null default 120 check (snipe_extend_s between 30 and 600),
  max_extensions integer not null default 10 check (max_extensions between 0 and 100),
  extensions_count integer not null default 0,
  status public.auction_status not null default 'active',
  outcome text check (outcome in ('sold', 'no_bids', 'reserve_not_met', 'unpaid', 'cancelled')),
  winner_id uuid references auth.users (id),
  winning_bid_cents integer,
  ended_at timestamptz,
  payment_due_at timestamptz,
  order_id uuid references public.orders (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index auctions_active_ends_idx on public.auctions (ends_at) where status = 'active';
create index auctions_store_idx on public.auctions (store_id, created_at desc);
create index auctions_product_idx on public.auctions (product_id);
create index auctions_lineage_idx on public.auctions (lineage_id);
create index auctions_winner_idx on public.auctions (winner_id) where winner_id is not null;
create index auctions_leader_idx on public.auctions (leader_id);
create index auctions_order_idx on public.auctions (order_id);
create trigger auctions_set_updated_at before update on public.auctions for each row execute function private.set_updated_at();

create table public.auction_bids (
  id bigint generated always as identity primary key,
  auction_id uuid not null references public.auctions (id) on delete cascade,
  bidder_id uuid not null references auth.users (id),
  bidder_alias text not null,
  amount_cents integer not null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 64),
  created_at timestamptz not null default now(),
  unique (auction_id, bidder_id, idempotency_key)
);
create index auction_bids_auction_idx on public.auction_bids (auction_id, id desc);
create index auction_bids_bidder_idx on public.auction_bids (bidder_id);

create table public.auction_events (
  id bigint generated always as identity primary key,
  auction_id uuid not null references public.auctions (id) on delete cascade,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index auction_events_auction_idx on public.auction_events (auction_id, id);

create table public.auction_bans (
  lineage_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  primary key (lineage_id, user_id)
);
create index auction_bans_user_idx on public.auction_bans (user_id);

create table public.auction_defaults (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  auction_id uuid not null references public.auctions (id),
  created_at timestamptz not null default now()
);
create index auction_defaults_user_idx on public.auction_defaults (user_id);
create index auction_defaults_auction_idx on public.auction_defaults (auction_id);

create table public.bid_blocks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  blocked_until timestamptz not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.auctions enable row level security;
alter table public.auction_bids enable row level security;
alter table public.auction_events enable row level security;
alter table public.auction_bans enable row level security;
alter table public.auction_defaults enable row level security;
alter table public.bid_blocks enable row level security;

create policy "leilões: públicos (exceto cancelados, que só a loja vê)" on public.auctions for select to anon, authenticated
  using (status <> 'cancelled' or store_id = (select private.my_store_id()));
create policy "lances: públicos" on public.auction_bids for select to anon, authenticated using (true);
create policy "eventos: loja lê" on public.auction_events for select to authenticated
  using (exists (select 1 from public.auctions a where a.id = auction_id and a.store_id = (select private.my_store_id())));
create policy "banimentos: o próprio lê" on public.auction_bans for select to authenticated using (user_id = (select auth.uid()));
create policy "inadimplências: o próprio lê" on public.auction_defaults for select to authenticated using (user_id = (select auth.uid()));
create policy "bloqueios: o próprio lê" on public.bid_blocks for select to authenticated using (user_id = (select auth.uid()));
-- Sem escrita direta em nenhuma tabela de leilão: tudo pelas funções abaixo.

-- Quem pode dar lance agora? Devolve null se pode, ou o código do impedimento.
create function private.bid_blocker(_uid uuid, _lineage uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  _v record;
  _sms boolean;
begin
  if _uid is null then return 'not_authenticated'; end if;
  select * into _v from public.user_verifications where user_id = _uid;
  if _v.user_id is null then return 'verification_required'; end if;
  select coalesce((select enabled from public.feature_flags where key = 'require_phone_sms'), false) into _sms;
  if _sms and _v.phone_verified_at is null then return 'phone_unverified'; end if;
  if exists (select 1 from public.bid_blocks where user_id = _uid and blocked_until > now()) then return 'bid_blocked'; end if;
  if _lineage is not null and exists (select 1 from public.auction_bans where lineage_id = _lineage and user_id = _uid) then
    return 'auction_banned';
  end if;
  return null;
end $$;

create function private.alias_for(_uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when char_length(p.display_name) <= 2 then left(p.display_name, 1) || '***'
    else left(p.display_name, 1) || '***' || right(regexp_replace(p.display_name, '\s+.*$', ''), 1)
  end
  from public.profiles p where p.id = _uid;
$$;

create function private.log_auction(_auction uuid, _type text, _data jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.auction_events (auction_id, type, data) values (_auction, _type, _data);
$$;

-- Criar leilão: reserva 1 unidade do produto
create function public.create_auction(
  _product_id uuid, _starting_cents integer, _increment_cents integer, _reserve_cents integer,
  _starts_at timestamptz, _duration_minutes integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _p record;
  _id uuid := gen_random_uuid();
  _start timestamptz := greatest(coalesce(_starts_at, now()), now());
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select p.*, s.owner_id, s.is_active as store_active into _p
  from public.products p join public.stores s on s.id = p.store_id where p.id = _product_id for update of p;
  if _p.id is null or _p.owner_id <> _uid then raise exception 'product_not_found' using errcode = 'P0001'; end if;
  if not _p.store_active then raise exception 'store_inactive' using errcode = 'P0001'; end if;
  if _p.stock < 1 then raise exception 'no_stock' using errcode = 'P0001'; end if;
  if _duration_minutes not between 5 and 10080 then raise exception 'invalid_duration' using errcode = 'P0001'; end if;
  if _start > now() + interval '30 days' then raise exception 'invalid_start' using errcode = 'P0001'; end if;

  perform set_config('app.stock_reason', 'auction_reserved', true);
  update public.products set stock = stock - 1 where id = _product_id;
  perform set_config('app.stock_reason', '', true);

  insert into public.auctions (id, lineage_id, store_id, product_id, title, starting_price_cents, min_increment_cents,
    reserve_price_cents, starts_at, ends_at, duration)
  values (_id, _id, _p.store_id, _product_id, _p.title, _starting_cents, _increment_cents, _reserve_cents,
    _start, _start + make_interval(mins => _duration_minutes), make_interval(mins => _duration_minutes));
  perform private.log_auction(_id, 'created', jsonb_build_object('starts_at', _start));
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (_uid, 'auction.create', 'auction', _id::text);
  return _id;
end $$;

create function private.release_auction_stock(_auction_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.stock_reason', 'auction_released', true);
  update public.products p set stock = p.stock + 1 from public.auctions a where a.id = _auction_id and p.id = a.product_id;
  perform set_config('app.stock_reason', '', true);
end $$;

-- Loja cancela leilão sem lances
create function public.cancel_auction(_auction_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _a record;
begin
  select a.*, s.owner_id into _a from public.auctions a join public.stores s on s.id = a.store_id where a.id = _auction_id for update of a;
  if _a.id is null or _a.owner_id <> _uid then raise exception 'auction_not_found' using errcode = 'P0001'; end if;
  if _a.status <> 'active' then raise exception 'auction_not_active' using errcode = 'P0001'; end if;
  if _a.bids_count > 0 then raise exception 'auction_has_bids' using errcode = 'P0001'; end if;
  update public.auctions set status = 'cancelled', outcome = 'cancelled', ended_at = now() where id = _auction_id;
  perform private.release_auction_stock(_auction_id);
  perform private.log_auction(_auction_id, 'cancelled');
end $$;

-- Dar lance. Uma transação por lance; a linha do leilão fica travada até o fim.
create function public.place_bid(_auction_id uuid, _amount_cents integer, _idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
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

  -- Repetição do mesmo clique: devolve o estado atual sem novo lance
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

-- Encerramento (roda a cada minuto pelo pg_cron)
create function private.close_due_auctions() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  _a record;
  _n integer := 0;
begin
  for _a in
    select * from public.auctions where status = 'active' and ends_at <= now() order by ends_at for update skip locked
  loop
    if _a.bids_count = 0 then
      update public.auctions set status = 'ended', outcome = 'no_bids', ended_at = now() where id = _a.id;
      perform private.release_auction_stock(_a.id);
      perform private.log_auction(_a.id, 'ended', '{"outcome":"no_bids"}');
    elsif _a.reserve_price_cents is not null and _a.current_price_cents < _a.reserve_price_cents then
      update public.auctions set status = 'ended', outcome = 'reserve_not_met', ended_at = now() where id = _a.id;
      perform private.release_auction_stock(_a.id);
      perform private.log_auction(_a.id, 'ended', '{"outcome":"reserve_not_met"}');
    else
      update public.auctions set status = 'ended', outcome = 'sold', ended_at = now(),
        winner_id = _a.leader_id, winning_bid_cents = _a.current_price_cents,
        payment_due_at = now() + interval '48 hours'
      where id = _a.id;
      perform private.log_auction(_a.id, 'ended', jsonb_build_object('outcome', 'sold', 'winning_bid_cents', _a.current_price_cents));
    end if;
    _n := _n + 1;
  end loop;
  return _n;
end $$;

-- Arremate não confirmado no prazo: perde o lote, não dá mais lance nele, lote volta ao leilão.
-- A partir da 3ª inadimplência: 7 dias sem poder dar lances.
create function private.process_unpaid_wins() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  _a record;
  _defaults integer;
  _new uuid;
  _n integer := 0;
begin
  for _a in
    select * from public.auctions
    where status = 'ended' and outcome = 'sold' and order_id is null and payment_due_at < now()
    order by payment_due_at for update skip locked
  loop
    update public.auctions set outcome = 'unpaid' where id = _a.id;
    insert into public.auction_defaults (user_id, auction_id) values (_a.winner_id, _a.id);
    insert into public.auction_bans (lineage_id, user_id, reason) values (_a.lineage_id, _a.winner_id, 'Arremate não confirmado no prazo')
      on conflict do nothing;
    select count(*) into _defaults from public.auction_defaults where user_id = _a.winner_id;
    if _defaults > 2 then
      insert into public.bid_blocks (user_id, blocked_until, reason)
      values (_a.winner_id, now() + interval '7 days', format('%s arremates não confirmados', _defaults))
      on conflict (user_id) do update set blocked_until = excluded.blocked_until, reason = excluded.reason;
    end if;

    _new := gen_random_uuid();
    insert into public.auctions (id, lineage_id, relist_count, store_id, product_id, title, starting_price_cents,
      min_increment_cents, reserve_price_cents, starts_at, ends_at, duration, snipe_window_s, snipe_extend_s, max_extensions)
    values (_new, _a.lineage_id, _a.relist_count + 1, _a.store_id, _a.product_id, _a.title, _a.starting_price_cents,
      _a.min_increment_cents, _a.reserve_price_cents, now(), now() + _a.duration, _a.duration,
      _a.snipe_window_s, _a.snipe_extend_s, _a.max_extensions);
    perform private.log_auction(_a.id, 'unpaid', jsonb_build_object('relisted_as', _new, 'defaults', _defaults));
    perform private.log_auction(_new, 'relisted', jsonb_build_object('from', _a.id));
    _n := _n + 1;
  end loop;
  return _n;
end $$;

create function private.run_auction_jobs() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return jsonb_build_object('closed', private.close_due_auctions(), 'unpaid', private.process_unpaid_wins());
end $$;

-- Vencedor confirma o arremate: cria o pedido (o estoque já estava reservado desde a criação do leilão)
create function public.confirm_auction_win(_auction_id uuid, _address_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _a record;
  _addr jsonb;
  _order uuid;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into _a from public.auctions where id = _auction_id for update;
  if _a.id is null or _a.winner_id is distinct from _uid then raise exception 'auction_not_found' using errcode = 'P0001'; end if;
  if _a.order_id is not null then return _a.order_id; end if;
  if _a.outcome <> 'sold' or _a.payment_due_at < now() then raise exception 'win_expired' using errcode = 'P0001'; end if;
  select to_jsonb(a) - 'user_id' - 'created_at' - 'is_default' into _addr
  from public.addresses a where a.id = _address_id and a.user_id = _uid;
  if _addr is null then raise exception 'address_not_found' using errcode = 'P0001'; end if;

  insert into public.orders (buyer_id, store_id, subtotal_cents, shipping_cents, total_cents, shipping_address)
  values (_uid, _a.store_id, _a.winning_bid_cents, 0, _a.winning_bid_cents, _addr)
  returning id into _order;
  insert into public.order_items (order_id, product_id, title, unit_price_cents, quantity)
  values (_order, _a.product_id, 'Arremate: ' || _a.title, _a.winning_bid_cents, 1);
  update public.auctions set order_id = _order where id = _auction_id;
  perform private.log_auction(_auction_id, 'confirmed', jsonb_build_object('order_id', _order));
  insert into public.audit_logs (actor_id, action, entity, entity_id, data)
  values (_uid, 'auction.confirm', 'order', _order::text, jsonb_build_object('auction_id', _auction_id));
  return _order;
end $$;

-- Situação do usuário em um leilão (para a página do leilão)
create function public.my_auction_status(_auction_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _a record;
begin
  select a.*, s.owner_id into _a from public.auctions a join public.stores s on s.id = a.store_id where a.id = _auction_id;
  if _a.id is null then return null; end if;
  return jsonb_build_object(
    'logged_in', _uid is not null,
    'is_seller', _a.owner_id = _uid,
    'is_leader', _a.leader_id = _uid,
    'is_winner', _a.winner_id = _uid,
    'blocker', case when _uid is null then 'not_authenticated' else private.bid_blocker(_uid, _a.lineage_id) end,
    'my_max_cents', (select max(amount_cents) from public.auction_bids where auction_id = _auction_id and bidder_id = _uid)
  );
end $$;

-- Meus lances (lista)
create function public.my_bids() returns table (
  auction_id uuid, title text, status public.auction_status, outcome text, ends_at timestamptz,
  current_price_cents integer, my_max_cents integer, is_leader boolean, is_winner boolean,
  payment_due_at timestamptz, order_id uuid
) language sql stable security definer set search_path = '' as $$
  select a.id, a.title, a.status, a.outcome, a.ends_at, a.current_price_cents, max(b.amount_cents),
         a.leader_id = auth.uid(), a.winner_id = auth.uid(), a.payment_due_at,
         case when a.winner_id = auth.uid() then a.order_id end
  from public.auction_bids b join public.auctions a on a.id = b.auction_id
  where b.bidder_id = auth.uid()
  group by a.id
  order by max(b.created_at) desc
  limit 100;
$$;

revoke execute on function public.create_auction(uuid, integer, integer, integer, timestamptz, integer) from public, anon;
revoke execute on function public.cancel_auction(uuid) from public, anon;
revoke execute on function public.place_bid(uuid, integer, text) from public, anon;
revoke execute on function public.confirm_auction_win(uuid, uuid) from public, anon;
revoke execute on function public.my_bids() from public, anon;
grant execute on function public.create_auction(uuid, integer, integer, integer, timestamptz, integer) to authenticated;
grant execute on function public.cancel_auction(uuid) to authenticated;
grant execute on function public.place_bid(uuid, integer, text) to authenticated;
grant execute on function public.confirm_auction_win(uuid, uuid) to authenticated;
grant execute on function public.my_bids() to authenticated;
grant execute on function public.my_auction_status(uuid) to anon, authenticated;
revoke execute on function private.bid_blocker(uuid, uuid), private.alias_for(uuid), private.log_auction(uuid, text, jsonb),
  private.release_auction_stock(uuid), private.close_due_auctions(), private.process_unpaid_wins(), private.run_auction_jobs(),
  private.cpf_is_valid(text) from public, anon, authenticated;

-- Tempo real: página do leilão recebe novos lances e o novo horário de fim
alter publication supabase_realtime add table public.auctions, public.auction_bids;

-- Encerramento automático a cada minuto
select cron.schedule('livelance-auction-jobs', '* * * * *', 'select private.run_auction_jobs()');

update public.feature_flags set enabled = true, description = 'LIVELANCE LEILÕES — leilões tradicionais e programados (Fase 3)' where key = 'auctions';
insert into public.feature_flags (key, enabled, description) values
  ('require_phone_sms', false, 'Exigir telefone confirmado por SMS para dar lances (ligar quando houver provedor de SMS)')
on conflict (key) do nothing;
