-- Marca: LIVELANCE → Zexi (não destrutiva). Só textos e valores padrão; nenhum dado de usuário é alterado.
-- O "tempero" do hash de CPF (livelance:cpf:) NÃO muda: trocar quebraria a regra de um CPF por conta.

update public.feature_flags set description = replace(replace(description, 'LIVELANCE', 'ZEXI'), 'IA da ZEXI', 'IA da Zexi')
where description like '%LIVELANCE%';

create or replace function private.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
    _name := 'Usuário Zexi';
  end if;

  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, left(_name, 80), new.raw_user_meta_data ->> 'avatar_url');

  insert into public.user_roles (user_id, role) values (new.id, 'buyer');

  insert into public.audit_logs (actor_id, action, entity, entity_id)
  values (new.id, 'user.signup', 'user', new.id::text);

  return new;
end $function$;

create or replace function public.become_affiliate()
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
  if coalesce(length(_base), 0) < 2 then _base := 'zexi'; end if;
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
end $function$;
