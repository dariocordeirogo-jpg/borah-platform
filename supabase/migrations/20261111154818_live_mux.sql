-- LIVELANCE LIVE + Mux: cada live pode ter uma transmissão no Mux.
-- A ligação fica no schema private (sem acesso pela API); só funções abaixo leem e gravam.
-- A chave de transmissão (stream key) NUNCA é gravada aqui: o servidor busca no Mux na hora, só para o dono.

create table private.live_streams (
  live_id uuid primary key references public.lives (id) on delete cascade,
  provider text not null default 'mux' check (provider = 'mux'),
  stream_id text not null unique check (stream_id ~ '^[A-Za-z0-9]{10,100}$'),
  playback_id text not null check (playback_id ~ '^[A-Za-z0-9]{10,100}$'),
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);
alter table private.live_streams enable row level security;

-- Dono da loja liga a transmissão criada no Mux à live; o link de reprodução passa a ser o do Mux.
create function public.attach_live_stream(_live_id uuid, _stream_id text, _playback_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare _l public.lives := private.my_live(_live_id);
begin
  if _l.status not in ('scheduled', 'live') then raise exception 'live_finished' using errcode = 'P0001'; end if;
  if _stream_id !~ '^[A-Za-z0-9]{10,100}$' or _playback_id !~ '^[A-Za-z0-9]{10,100}$' then
    raise exception 'invalid_stream' using errcode = 'P0001';
  end if;
  if exists (select 1 from private.live_streams where live_id = _l.id) then
    raise exception 'stream_exists' using errcode = 'P0001';
  end if;
  insert into private.live_streams (live_id, stream_id, playback_id) values (_l.id, _stream_id, _playback_id);
  update public.lives set playback_url = 'https://stream.mux.com/' || _playback_id || '.m3u8' where id = _l.id;
  insert into public.audit_logs (actor_id, action, entity, entity_id) values (auth.uid(), 'live.stream.attach', 'live', _l.id::text);
end $$;

-- Dono da loja ou moderação: qual transmissão do Mux é desta live (para mostrar a chave ou desligar).
create function public.live_stream_ref(_live_id uuid)
returns table (stream_id text, playback_id text, disabled_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.lives l where l.id = _live_id and l.store_id = private.my_store_id())
     and not private.staff_can('moderate') then
    raise exception 'live_not_found' using errcode = 'P0001';
  end if;
  return query select s.stream_id, s.playback_id, s.disabled_at from private.live_streams s where s.live_id = _live_id;
end $$;

-- Registra que a transmissão foi desligada no Mux (a live já terminou).
create function public.mark_live_stream_disabled(_live_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.lives l where l.id = _live_id and l.store_id = private.my_store_id())
     and not private.staff_can('moderate') then
    raise exception 'live_not_found' using errcode = 'P0001';
  end if;
  update private.live_streams set disabled_at = now() where live_id = _live_id and disabled_at is null;
end $$;

revoke execute on function public.attach_live_stream(uuid, text, text), public.live_stream_ref(uuid),
  public.mark_live_stream_disabled(uuid) from public, anon;
grant execute on function public.attach_live_stream(uuid, text, text), public.live_stream_ref(uuid),
  public.mark_live_stream_disabled(uuid) to authenticated;
