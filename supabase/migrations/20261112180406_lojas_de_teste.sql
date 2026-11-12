-- Lojas das contas de teste automático (e-mail @livelance.test) ficam fora das vitrines públicas em produção.
-- A marca é calculada pelo banco a partir do e-mail do dono: ninguém marca ou desmarca pela API.
alter table public.stores add column is_test boolean not null default false;
comment on column public.stores.is_test is 'Loja das contas de teste automático (e2e). Escondida das listagens públicas em produção.';

create function private.stores_set_is_test() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.is_test := exists (select 1 from auth.users u where u.id = new.owner_id and u.email like '%@livelance.test');
  return new;
end $$;
revoke execute on function private.stores_set_is_test() from public, anon, authenticated;

create trigger stores_set_is_test before insert or update on public.stores
  for each row execute function private.stores_set_is_test();

update public.stores set is_test = is_test;  -- recalcula as lojas existentes pelo gatilho
