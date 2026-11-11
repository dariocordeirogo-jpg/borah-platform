-- Fase 8: Admin — denúncias, moderação, lojas, pedidos e números da plataforma
-- Toda ação da equipe passa por função com checagem de papel e fica na auditoria (com o motivo).

-- Quem pode o quê
--   moderar (produto, vídeo, live, chat, denúncias): admin_super, admin_ops, moderator
--   lojas (suspender/reativar):                       admin_super, admin_ops
--   ver números e pedidos:                            qualquer papel da equipe (private.is_admin)
create function private.staff_can(_area text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid())
      and role = any (case _area
        when 'moderate' then array['admin_super', 'admin_ops', 'moderator']::public.app_role[]
        when 'stores' then array['admin_super', 'admin_ops']::public.app_role[]
        when 'view' then array['admin_super', 'admin_finance', 'admin_ops', 'moderator', 'support', 'analyst']::public.app_role[]
        else array[]::public.app_role[] end)
  )
$$;
revoke execute on function private.staff_can(text) from public, anon;
grant execute on function private.staff_can(text) to authenticated;

-- Produto bloqueado pela moderação: a loja não consegue reativar sozinha
alter table public.products add column blocked_reason text check (char_length(blocked_reason) <= 300);

create function private.guard_blocked_product() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.blocked_reason is not null and new.blocked_reason is not null and new.status = 'active' then
    raise exception 'product_blocked' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger products_guard_blocked before update of status on public.products
  for each row execute function private.guard_blocked_product();

-- Denúncias
create type public.report_kind as enum ('product', 'video', 'live', 'store', 'message');
create type public.report_status as enum ('open', 'actioned', 'dismissed');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  kind public.report_kind not null,
  target_id text not null check (char_length(target_id) <= 64),
  reason text not null check (reason in ('fraude', 'proibido', 'ofensivo', 'falsificado', 'spam', 'outro')),
  details text check (char_length(details) <= 500),
  status public.report_status not null default 'open',
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);
create unique index reports_one_open_per_target on public.reports (reporter_id, kind, target_id) where status = 'open';

alter table public.reports enable row level security;
create policy "denúncias: quem denunciou ou equipe lê" on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.staff_can('moderate')));
revoke insert, update, delete, truncate on public.reports from anon, authenticated;

-- A equipe enxerga o que precisa moderar ou acompanhar (somado às regras que já existem)
create policy "lojas: equipe lê" on public.stores for select to authenticated using ((select private.is_admin()));
create policy "produtos: equipe lê" on public.products for select to authenticated using ((select private.is_admin()));
create policy "pedidos: equipe lê" on public.orders for select to authenticated using ((select private.is_admin()));
create policy "itens: equipe lê" on public.order_items for select to authenticated using ((select private.is_admin()));
create policy "pagamentos: equipe lê" on public.payments for select to authenticated using ((select private.is_admin()));
create policy "vídeos: equipe lê" on public.videos for select to authenticated using ((select private.is_admin()));
create policy "lives: equipe lê" on public.lives for select to authenticated using ((select private.is_admin()));
create policy "chat: equipe lê" on public.live_messages for select to authenticated using ((select private.is_admin()));

-- Usuário denuncia (até 20 por dia; uma denúncia aberta por item)
create function public.report_content(_kind public.report_kind, _target_id text, _reason text, _details text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid := auth.uid();
  _id uuid;
  _found boolean;
begin
  if _uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if (select count(*) from public.reports where reporter_id = _uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too_many_reports' using errcode = 'P0001';
  end if;
  if _kind = 'product' then _found := exists (select 1 from public.products where id::text = _target_id);
  elsif _kind = 'video' then _found := exists (select 1 from public.videos where id::text = _target_id);
  elsif _kind = 'live' then _found := exists (select 1 from public.lives where id::text = _target_id);
  elsif _kind = 'store' then _found := exists (select 1 from public.stores where id::text = _target_id);
  else _found := exists (select 1 from public.live_messages where id::text = _target_id);
  end if;
  if not _found then raise exception 'target_not_found' using errcode = 'P0001'; end if;
  insert into public.reports (reporter_id, kind, target_id, reason, details)
  values (_uid, _kind, _target_id, _reason, nullif(btrim(left(_details, 500)), ''))
  on conflict (reporter_id, kind, target_id) where status = 'open' do nothing
  returning id into _id;
  if _id is null then raise exception 'already_reported' using errcode = 'P0001'; end if;
  return _id;
end $$;

-- Painel: números da plataforma
create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.staff_can('view') then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'stores_active', (select count(*) from public.stores where is_active),
    'stores_suspended', (select count(*) from public.stores where not is_active),
    'products_active', (select count(*) from public.products where status = 'active'),
    'products_blocked', (select count(*) from public.products where blocked_reason is not null),
    'orders', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.orders group by status) t),
    'gmv_cents', (select coalesce(sum(amount_cents), 0) from public.payments where status = 'succeeded'),
    'fees_cents', (select coalesce(sum(fee_cents), 0) from public.payments where status = 'succeeded'),
    'refunded_cents', (select coalesce(sum(amount_cents), 0) from public.payments where status = 'refunded'),
    'needs_refund', (select count(*) from public.payments where needs_refund),
    'affiliate_confirmed_cents', (select coalesce(sum(amount_cents), 0) from public.affiliate_commissions where status = 'confirmed'),
    'auctions_active', (select count(*) from public.auctions where status = 'active'),
    'lives_now', (select count(*) from public.lives where status = 'live'),
    'videos_published', (select count(*) from public.videos where status = 'published'),
    'reports_open', (select count(*) from public.reports where status = 'open')
  );
end $$;

create function private.staff_log(_action text, _entity text, _id text, _reason text) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, action, entity, entity_id, data)
  values (auth.uid(), _action, _entity, _id, jsonb_build_object('reason', _reason))
$$;

create function private.require_reason(_reason text) returns text
language plpgsql immutable as $$
begin
  if char_length(btrim(coalesce(_reason, ''))) < 3 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  return left(btrim(_reason), 300);
end $$;

-- Moderação de produto
create function public.admin_block_product(_product_id uuid, _reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare _r text := private.require_reason(_reason);
begin
  if not private.staff_can('moderate') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.products set status = 'paused', blocked_reason = _r where id = _product_id;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform private.staff_log('admin.product.block', 'product', _product_id::text, _r);
end $$;

create function public.admin_unblock_product(_product_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.staff_can('moderate') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.products set blocked_reason = null where id = _product_id and blocked_reason is not null;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform private.staff_log('admin.product.unblock', 'product', _product_id::text, null);
end $$;

-- Lojas: suspender tira loja, produtos, vídeos e lives do público (pelas regras de visibilidade)
create function public.admin_set_store_active(_store_id uuid, _active boolean, _reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare _r text := case when _active then left(btrim(coalesce(_reason, '')), 300) else private.require_reason(_reason) end;
begin
  if not private.staff_can('stores') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.stores set is_active = _active where id = _store_id;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if not _active then
    update public.lives set status = case when status = 'live' then 'ended'::public.live_status else 'cancelled'::public.live_status end,
      ended_at = now(), pinned_product_id = null
    where store_id = _store_id and status in ('scheduled', 'live');
  end if;
  perform private.staff_log(case when _active then 'admin.store.reactivate' else 'admin.store.suspend' end, 'store', _store_id::text, _r);
end $$;

create function public.admin_remove_video(_video_id uuid, _reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare _r text := private.require_reason(_reason);
begin
  if not private.staff_can('moderate') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.videos set status = 'removed' where id = _video_id and status = 'published';
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform private.staff_log('admin.video.remove', 'video', _video_id::text, _r);
end $$;

create function public.admin_end_live(_live_id uuid, _reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare _r text := private.require_reason(_reason);
begin
  if not private.staff_can('moderate') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.lives set status = case when status = 'live' then 'ended'::public.live_status else 'cancelled'::public.live_status end,
    ended_at = now(), pinned_product_id = null
  where id = _live_id and status in ('scheduled', 'live');
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform private.staff_log('admin.live.end', 'live', _live_id::text, _r);
end $$;

create function public.admin_hide_message(_message_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.staff_can('moderate') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.live_messages set hidden = true where id = _message_id;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform private.staff_log('admin.message.hide', 'live_message', _message_id::text, null);
end $$;

create function public.admin_resolve_report(_report_id uuid, _status public.report_status, _note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.staff_can('moderate') then raise exception 'forbidden' using errcode = '42501'; end if;
  if _status = 'open' then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  update public.reports set status = _status, resolved_by = auth.uid(), resolved_at = now(), note = nullif(left(btrim(_note), 300), '')
  where id = _report_id and status = 'open';
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform private.staff_log('admin.report.' || _status::text, 'report', _report_id::text, _note);
end $$;

revoke execute on function private.guard_blocked_product(), private.staff_log(text, text, text, text), private.require_reason(text)
  from public, anon, authenticated;
revoke execute on function public.report_content(public.report_kind, text, text, text), public.admin_overview(),
  public.admin_block_product(uuid, text), public.admin_unblock_product(uuid), public.admin_set_store_active(uuid, boolean, text),
  public.admin_remove_video(uuid, text), public.admin_end_live(uuid, text), public.admin_hide_message(bigint),
  public.admin_resolve_report(uuid, public.report_status, text) from public, anon;
grant execute on function public.report_content(public.report_kind, text, text, text), public.admin_overview(),
  public.admin_block_product(uuid, text), public.admin_unblock_product(uuid), public.admin_set_store_active(uuid, boolean, text),
  public.admin_remove_video(uuid, text), public.admin_end_live(uuid, text), public.admin_hide_message(bigint),
  public.admin_resolve_report(uuid, public.report_status, text) to authenticated;
