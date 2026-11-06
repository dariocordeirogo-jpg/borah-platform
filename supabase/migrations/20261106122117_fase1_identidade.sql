-- BORAH · Fase 1 · Identidade, papéis, endereços, auditoria e feature flags
-- Aplicada no projeto Supabase borah-platform (elygbieuroidqxkifgou) em 2026-11-06.

create type public.app_role as enum (
  'buyer', 'seller', 'affiliate', 'creator',
  'admin_super', 'admin_finance', 'admin_ops', 'moderator', 'support', 'analyst'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  username text unique check (username ~ '^[a-z0-9_]{3,30}$'),
  avatar_url text,
  bio text check (char_length(bio) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id),
  primary key (user_id, role)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null default 'Casa' check (char_length(label) <= 40),
  recipient text not null check (char_length(recipient) between 2 and 120),
  cep text not null check (cep ~ '^[0-9]{8}$'),
  street text not null,
  number text not null,
  complement text,
  district text not null,
  city text not null,
  state char(2) not null check (state ~ '^[A-Z]{2}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index addresses_user_id_idx on public.addresses (user_id);
create unique index addresses_one_default_per_user on public.addresses (user_id) where is_default;

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);

create table public.feature_flags (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  enabled boolean not null default false,
  description text
);

-- updated_at automático
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- Checagem de papel (usada pelas políticas RLS)
create function public.has_role(_role public.app_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = _role
  );
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid())
      and role in ('admin_super', 'admin_finance', 'admin_ops', 'moderator', 'support', 'analyst')
  );
$$;

-- Novo usuário: cria perfil e dá o papel de comprador
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  _name text;
begin
  _name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );
  if char_length(_name) < 2 then
    _name := 'Usuário BORAH';
  end if;

  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, left(_name, 80), new.raw_user_meta_data ->> 'avatar_url');

  insert into public.user_roles (user_id, role) values (new.id, 'buyer');

  insert into public.audit_logs (actor_id, action, entity, entity_id)
  values (new.id, 'user.signup', 'user', new.id::text);

  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Funções internas não ficam expostas pela API
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.addresses enable row level security;
alter table public.audit_logs enable row level security;
alter table public.feature_flags enable row level security;

create policy "perfil: dono ou admin lê" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "perfil: dono edita" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "papéis: dono ou admin lê" on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
-- Sem políticas de escrita: papéis só mudam pelo servidor (service role).

create policy "endereços: dono lê" on public.addresses
  for select to authenticated using (user_id = (select auth.uid()));
create policy "endereços: dono cria" on public.addresses
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "endereços: dono edita" on public.addresses
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "endereços: dono apaga" on public.addresses
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "auditoria: admin lê" on public.audit_logs
  for select to authenticated using ((select public.is_admin()));
-- Sem políticas de escrita: auditoria só é gravada por funções do banco.

create policy "flags: todos leem" on public.feature_flags
  for select to anon, authenticated using (true);

-- Colunas que o dono pode editar no próprio perfil
revoke update on public.profiles from authenticated;
grant update (display_name, username, avatar_url, bio) on public.profiles to authenticated;

insert into public.feature_flags (key, enabled, description) values
  ('auctions', false, 'BORAH LANCES — liberado na Fase 3'),
  ('payments', false, 'Pagamentos reais — liberado na Fase 4'),
  ('affiliates', false, 'BORAH INDICA — liberado na Fase 5'),
  ('videos', false, 'BORAH VÍDEOS — liberado na Fase 6'),
  ('live', false, 'BORAH AO VIVO — liberado na Fase 7');
