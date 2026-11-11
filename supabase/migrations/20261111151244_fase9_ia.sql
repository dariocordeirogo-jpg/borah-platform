-- Fase 9: IA (Claude) — cota diária por recurso e triagem de denúncias
-- A IA só sugere: descrição o vendedor revisa; busca vira filtros; triagem a equipe decide.

create table private.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  day date not null,
  calls integer not null default 0,
  primary key (user_id, feature, day)
);
alter table private.ai_usage enable row level security;

insert into public.feature_flags (key, enabled, description)
values ('ai', true, 'IA da LIVELANCE (descrição, busca, triagem) — Fase 9')
on conflict (key) do update set description = excluded.description;

-- Gasta 1 da cota do dia. Limites por recurso; recurso desconhecido é recusado.
create function public.ai_take_quota(_feature text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _limit integer := case _feature when 'description' then 30 when 'search' then 60 when 'triage' then 300 else 0 end;
  _calls integer;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if _limit = 0 then raise exception 'invalid_feature' using errcode = 'P0001'; end if;
  if not coalesce((select enabled from public.feature_flags where key = 'ai'), false) then return false; end if;
  if _feature = 'triage' and not private.staff_can('moderate') then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into private.ai_usage (user_id, feature, day, calls)
  values (_uid, _feature, (now() at time zone 'America/Sao_Paulo')::date, 1)
  on conflict (user_id, feature, day) do update set calls = private.ai_usage.calls + 1
  returning calls into _calls;
  if _calls > _limit then
    update private.ai_usage set calls = calls - 1
    where user_id = _uid and feature = _feature and day = (now() at time zone 'America/Sao_Paulo')::date;
    return false;
  end if;
  return true;
end $$;
revoke execute on function public.ai_take_quota(text) from public, anon;
grant execute on function public.ai_take_quota(text) to authenticated;

-- Triagem da IA guardada na denúncia (só sugestão; quem decide é a equipe)
alter table public.reports add column ai_triage jsonb;

create function public.admin_set_report_triage(_report_id uuid, _triage jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.staff_can('moderate') then raise exception 'forbidden' using errcode = '42501'; end if;
  if jsonb_typeof(_triage) <> 'object'
     or (_triage ->> 'severity') not in ('baixa', 'media', 'alta')
     or (_triage ->> 'recommendation') not in ('agir', 'descartar', 'revisar')
     or char_length(coalesce(_triage ->> 'rationale', '')) not between 1 and 600 then
    raise exception 'invalid_triage' using errcode = 'P0001';
  end if;
  update public.reports set ai_triage = jsonb_build_object(
    'severity', _triage ->> 'severity',
    'recommendation', _triage ->> 'recommendation',
    'rationale', _triage ->> 'rationale',
    'at', now()
  ) where id = _report_id and status = 'open';
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
end $$;
revoke execute on function public.admin_set_report_triage(uuid, jsonb) from public, anon;
grant execute on function public.admin_set_report_triage(uuid, jsonb) to authenticated;
