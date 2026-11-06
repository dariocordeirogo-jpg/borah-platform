-- Migração de marca BORAH → LIVELANCE. Não destrutiva: só atualiza textos.
-- Identificadores internos (nomes de tabelas, enums, chaves de flags) não mudam.
-- Aplicada no projeto Supabase (ref elygbieuroidqxkifgou) em 2026-11-06.

update public.feature_flags set description = case key
  when 'auctions'   then 'LIVELANCE LEILÕES — liberado na Fase 3'
  when 'payments'   then 'LIVELANCE PAY (pagamentos reais) — liberado na Fase 4'
  when 'affiliates' then 'Indique e ganhe (afiliados) — liberado na Fase 5'
  when 'videos'     then 'Vídeos do LIVELANCE LIVE — liberado na Fase 6'
  when 'live'       then 'LIVELANCE LIVE — liberado na Fase 7'
  else description end
where key in ('auctions', 'payments', 'affiliates', 'videos', 'live');

-- Mesmo comportamento; muda apenas o nome padrão de quem se cadastra sem nome.
create or replace function private.handle_new_user() returns trigger
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
    _name := 'Usuário LIVELANCE';
  end if;

  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, left(_name, 80), new.raw_user_meta_data ->> 'avatar_url');

  insert into public.user_roles (user_id, role) values (new.id, 'buyer');

  insert into public.audit_logs (actor_id, action, entity, entity_id)
  values (new.id, 'user.signup', 'user', new.id::text);

  return new;
end $$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;
