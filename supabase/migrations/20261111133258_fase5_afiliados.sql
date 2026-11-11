-- Fase 5: Indique e ganhe (afiliados)
-- Link de indicação → cookie de 30 dias → pedido atribuído no banco → comissão paga pela plataforma
-- (sai da comissão da LIVELANCE; o vendedor recebe o mesmo valor). Autoindicação não conta.

create type public.commission_status as enum ('pending', 'confirmed', 'cancelled');

create table private.affiliate_settings (
  id boolean primary key default true check (id),
  rate_bps integer not null default 300 check (rate_bps between 0 and 2000),
  cookie_days integer not null default 30 check (cookie_days between 1 and 90)
);
insert into private.affiliate_settings default values;

create table public.affiliates (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{4,24}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Cliques por dia (só contador; sem dado de quem clicou)
create table public.affiliate_clicks (
  user_id uuid not null references public.affiliates (user_id) on delete cascade,
  day date not null,
  clicks integer not null default 0 check (clicks >= 0),
  primary key (user_id, day)
);

create table public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  order_number bigint not null,
  affiliate_id uuid not null references public.affiliates (user_id) on delete cascade,
  base_cents integer not null check (base_cents >= 0),
  rate_bps integer not null check (rate_bps >= 0),
  amount_cents integer not null check (amount_cents >= 0),
  status public.commission_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index affiliate_commissions_affiliate_idx on public.affiliate_commissions (affiliate_id, created_at desc);

create trigger affiliate_commissions_set_updated_at before update on public.affiliate_commissions
  for each row execute function private.set_updated_at();

alter table public.affiliates enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_commissions enable row level security;

create policy "afiliado: dono lê" on public.affiliates for select to authenticated using (user_id = (select auth.uid()));
create policy "cliques: dono lê" on public.affiliate_clicks for select to authenticated using (user_id = (select auth.uid()));
create policy "comissões: afiliado lê" on public.affiliate_commissions for select to authenticated using (affiliate_id = (select auth.uid()));

revoke insert, update, delete, truncate on public.affiliates, public.affiliate_clicks, public.affiliate_commissions from anon, authenticated;

update public.feature_flags set enabled = true, description = 'Indique e ganhe (afiliados) — liberado na Fase 5' where key = 'affiliates';

-- Taxa e janela do cookie (para exibir; o cálculo vale só no banco)
create function public.affiliate_program() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('rate_bps', rate_bps, 'cookie_days', cookie_days) from private.affiliate_settings where id
$$;
grant execute on function public.affiliate_program() to anon, authenticated;

-- Vira afiliado (idempotente). Código a partir do nome + sufixo aleatório.
create function public.become_affiliate() returns text
language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _code text;
  _base text;
  _try integer := 0;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select code into _code from public.affiliates where user_id = _uid;
  if _code is not null then return _code; end if;
  if not coalesce((select enabled from public.feature_flags where key = 'affiliates'), false) then
    raise exception 'affiliates_disabled' using errcode = 'P0001';
  end if;

  select left(regexp_replace(translate(lower(split_part(coalesce(display_name, ''), ' ', 1)),
    'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]', '', 'g'), 12)
  into _base from public.profiles where id = _uid;
  if coalesce(length(_base), 0) < 2 then _base := 'livelance'; end if;
  loop
    _try := _try + 1;
    _code := _base || substr(md5(gen_random_uuid()::text), 1, 4);
    begin
      insert into public.affiliates (user_id, code) values (_uid, _code);
      exit;
    exception when unique_violation then
      if _try > 5 then raise; end if;
    end;
  end loop;
  insert into public.user_roles (user_id, role) values (_uid, 'affiliate') on conflict do nothing;
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (_uid, 'affiliate.join', 'affiliate', _code);
  return _code;
end $$;
revoke execute on function public.become_affiliate() from public, anon;
grant execute on function public.become_affiliate() to authenticated;

-- Clique no link: valida o código e soma no contador do dia. Devolve se o código existe.
create function public.track_referral(_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare _aff uuid;
begin
  if _code is null or lower(_code) !~ '^[a-z0-9]{4,24}$' then return false; end if;
  select user_id into _aff from public.affiliates where code = lower(_code) and is_active;
  if _aff is null then return false; end if;
  insert into public.affiliate_clicks (user_id, day, clicks) values (_aff, (now() at time zone 'America/Sao_Paulo')::date, 1)
  on conflict (user_id, day) do update set clicks = public.affiliate_clicks.clicks + 1;
  return true;
end $$;
revoke execute on function public.track_referral(text) from public;
grant execute on function public.track_referral(text) to anon, authenticated;

-- Checkout com indicação: cria os pedidos normalmente e registra a comissão de cada um.
-- Código inválido, autoindicação ou indicação da própria loja simplesmente não geram comissão.
create function public.checkout_with_ref(_address_id uuid, _ref_code text default null)
returns uuid[] language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _orders uuid[];
  _aff uuid;
  _rate integer;
begin
  _orders := public.checkout(_address_id);
  if _ref_code is null or lower(_ref_code) !~ '^[a-z0-9]{4,24}$' then return _orders; end if;
  select user_id into _aff from public.affiliates where code = lower(_ref_code) and is_active;
  if _aff is null or _aff = _uid then return _orders; end if;
  select rate_bps into _rate from private.affiliate_settings where id;

  insert into public.affiliate_commissions (order_id, order_number, affiliate_id, base_cents, rate_bps, amount_cents)
  select o.id, o.number, _aff, o.total_cents, _rate, (round(o.total_cents::numeric * _rate / 10000))::integer
  from public.orders o join public.stores s on s.id = o.store_id
  where o.id = any (_orders) and s.owner_id <> _aff;
  return _orders;
end $$;
revoke execute on function public.checkout_with_ref(uuid, text) from public, anon;
grant execute on function public.checkout_with_ref(uuid, text) to authenticated;

-- Comissão acompanha o pedido: pago → confirmada; cancelado/reembolsado → cancelada
create function private.sync_commission() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    update public.affiliate_commissions set status = case
      when new.status in ('paid', 'shipped', 'delivered') then 'confirmed'::public.commission_status
      when new.status = 'cancelled' then 'cancelled'::public.commission_status
      else status end
    where order_id = new.id and status <> 'cancelled';
  end if;
  return new;
end $$;
create trigger orders_sync_commission after update of status on public.orders
  for each row execute function private.sync_commission();

revoke execute on function private.sync_commission() from public, anon, authenticated;
