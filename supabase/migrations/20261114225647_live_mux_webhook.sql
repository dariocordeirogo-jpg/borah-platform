-- Avisos do Mux (webhook): o banco sabe se o sinal da loja está chegando, mostra "sinal caiu" para quem assiste
-- e encerra sozinho a live abandonada. A assinatura (Mux-Signature: t=..,v1=..) é conferida aqui com o segredo do Vault.

alter table public.lives
  add column stream_signal text check (stream_signal in ('active', 'idle')),
  add column stream_signal_at timestamptz;

create table private.mux_events (
  id text primary key check (char_length(id) between 1 and 100),
  type text not null,
  received_at timestamptz not null default now()
);
alter table private.mux_events enable row level security;

create function private.mux_signature_ok(_payload text, _header text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  _secret text;
  _t text;
  _sigs text[] := '{}';
  _part text;
begin
  select decrypted_secret into _secret from vault.decrypted_secrets where name = 'mux_webhook_secret' limit 1;
  if _secret is null or length(_secret) < 16 then raise exception 'webhook_not_configured' using errcode = 'P0001'; end if;
  foreach _part in array string_to_array(coalesce(_header, ''), ',') loop
    _part := btrim(_part);
    if _part like 't=%' then _t := substr(_part, 3);
    elsif _part like 'v1=%' then _sigs := array_append(_sigs, lower(substr(_part, 4)));
    end if;
  end loop;
  if _t is null or _t !~ '^[0-9]{1,12}$' or cardinality(_sigs) = 0 then return false; end if;
  if abs(extract(epoch from now()) - _t::bigint) > 300 then return false; end if;
  return encode(extensions.hmac(convert_to(_t || '.' || _payload, 'UTF8'), convert_to(_secret, 'UTF8'), 'sha256'), 'hex') = any (_sigs);
end $$;

-- Recebe um aviso do Mux. Devolve {action: 'disable', stream_id} quando a transmissão pertence a uma live
-- que já saiu do ar (encerrada, cancelada ou loja suspensa): o servidor desliga a chave no Mux.
create function public.mux_ingest_event(_payload text, _signature text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _e jsonb;
  _id text;
  _type text;
  _stream text;
  _s record;
begin
  if not private.mux_signature_ok(_payload, _signature) then raise exception 'invalid_signature' using errcode = '28000'; end if;
  _e := _payload::jsonb;
  _id := _e->>'id';
  _type := coalesce(_e->>'type', '');
  if _id is null then return jsonb_build_object('result', 'ignored'); end if;
  insert into private.mux_events (id, type) values (_id, _type) on conflict (id) do nothing;
  if not found then return jsonb_build_object('result', 'duplicate', 'duplicate', true); end if;

  -- Aviso interno do servidor (assinado com o mesmo segredo): a chave foi desligada no Mux
  if _type = 'zexi.stream_disabled' then
    update private.live_streams set disabled_at = coalesce(disabled_at, now()) where stream_id = _e->'data'->>'id';
    return jsonb_build_object('result', 'marked_disabled');
  end if;

  if _type not like 'video.live_stream.%' then return jsonb_build_object('result', 'ignored'); end if;
  _stream := _e->'data'->>'id';
  select ls.live_id, ls.disabled_at, l.status into _s
  from private.live_streams ls join public.lives l on l.id = ls.live_id where ls.stream_id = _stream;
  if _s.live_id is null then return jsonb_build_object('result', 'unknown_stream'); end if;

  if _s.status not in ('scheduled', 'live') then
    return case when _s.disabled_at is null
      then jsonb_build_object('result', 'live_finished', 'action', 'disable', 'stream_id', _stream)
      else jsonb_build_object('result', 'live_finished') end;
  end if;

  if _type in ('video.live_stream.active', 'video.live_stream.recording', 'video.live_stream.connected') then
    update public.lives set stream_signal = 'active', stream_signal_at = now() where id = _s.live_id and stream_signal is distinct from 'active';
    return jsonb_build_object('result', 'signal_active');
  elsif _type in ('video.live_stream.idle', 'video.live_stream.disconnected') then
    update public.lives set stream_signal = 'idle', stream_signal_at = now() where id = _s.live_id and stream_signal is distinct from 'idle';
    return jsonb_build_object('result', 'signal_idle');
  end if;
  return jsonb_build_object('result', 'ignored');
end $$;

-- Lives esquecidas: no ar sem sinal há 30 min, no ar há mais de 8 h, ou programadas há mais de 24 h sem começar
create function private.close_abandoned_lives() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  _l record;
  _n integer := 0;
begin
  for _l in
    select id, status from public.lives
    where (status = 'live' and ((stream_signal = 'idle' and stream_signal_at < now() - interval '30 minutes')
                                or started_at < now() - interval '8 hours'))
       or (status = 'scheduled' and scheduled_at < now() - interval '24 hours')
    for update skip locked
  loop
    if _l.status = 'live' then
      update public.lives set status = 'ended', ended_at = now(), pinned_product_id = null where id = _l.id;
    else
      update public.lives set status = 'cancelled', ended_at = now() where id = _l.id;
    end if;
    insert into public.audit_logs (actor_id, action, entity, entity_id) values (null, 'live.auto_end', 'live', _l.id::text);
    _n := _n + 1;
  end loop;
  delete from private.mux_events where received_at < now() - interval '30 days';
  return _n;
end $$;

select cron.schedule('zexi-close-abandoned-lives', '*/5 * * * *', 'select private.close_abandoned_lives()');

revoke execute on function private.mux_signature_ok(text, text), private.close_abandoned_lives() from public, anon, authenticated;
revoke execute on function public.mux_ingest_event(text, text) from public;
grant execute on function public.mux_ingest_event(text, text) to anon, authenticated;
