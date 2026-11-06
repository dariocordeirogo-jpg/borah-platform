-- Tira as funções de checagem de papel da API pública (schema private não é exposto pelo PostgREST)
create schema if not exists private;
grant usage on schema private to anon, authenticated;

alter function public.has_role(public.app_role) set schema private;
alter function public.is_admin() set schema private;
alter function public.handle_new_user() set schema private;
alter function public.set_updated_at() set schema private;

revoke execute on function private.has_role(public.app_role) from public, anon;
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.has_role(public.app_role) to authenticated;
grant execute on function private.is_admin() to authenticated;
