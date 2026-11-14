-- ZEXI LIVE: transmitir pelo navegador (câmera do celular ou do computador) com o Cloudflare Stream (WebRTC).
-- A loja envia o vídeo por WHIP e quem assiste recebe por WHEP. O endereço de envio (WHIP) é segredo da loja:
-- nunca é gravado aqui; o servidor busca na Cloudflare na hora, só para o dono. O de reprodução (WHEP) é público.

alter table private.live_streams drop constraint live_streams_provider_check;
alter table private.live_streams add constraint live_streams_provider_check check (provider in ('mux', 'cloudflare'));

-- Dono da loja liga a entrada criada na Cloudflare à live; o link de reprodução passa a ser o WHEP dela.
create function public.attach_browser_stream(_live_id uuid, _input_uid text, _play_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare _l public.lives := private.my_live(_live_id);
begin
  if _l.status not in ('scheduled', 'live') then raise exception 'live_finished' using errcode = 'P0001'; end if;
  if _input_uid !~ '^[a-f0-9]{32}$'
     or _play_url !~ ('^https://customer-[a-z0-9]{8,40}\.cloudflarestream\.com/' || _input_uid || '/webRTC/play$') then
    raise exception 'invalid_stream' using errcode = 'P0001';
  end if;
  if exists (select 1 from private.live_streams where live_id = _l.id) then
    raise exception 'stream_exists' using errcode = 'P0001';
  end if;
  insert into private.live_streams (live_id, provider, stream_id, playback_id) values (_l.id, 'cloudflare', _input_uid, _input_uid);
  update public.lives set playback_url = _play_url where id = _l.id;
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (auth.uid(), 'live.stream.attach', 'live', _l.id::text);
end $$;

-- A referência passa a dizer qual serviço transmite (Mux por OBS/app, Cloudflare pelo navegador).
drop function public.live_stream_ref(uuid);
create function public.live_stream_ref(_live_id uuid)
returns table (provider text, stream_id text, playback_id text, disabled_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.lives l where l.id = _live_id and l.store_id = private.my_store_id())
     and not private.staff_can('moderate') then
    raise exception 'live_not_found' using errcode = 'P0001';
  end if;
  return query select s.provider, s.stream_id, s.playback_id, s.disabled_at from private.live_streams s where s.live_id = _live_id;
end $$;

revoke execute on function public.attach_browser_stream(uuid, text, text), public.live_stream_ref(uuid) from public, anon;
grant execute on function public.attach_browser_stream(uuid, text, text), public.live_stream_ref(uuid) to authenticated;
