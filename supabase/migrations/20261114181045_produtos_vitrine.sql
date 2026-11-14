-- Produtos de vitrine: anúncios de demonstração (estoque 0) usados para preencher o site no lançamento.
-- Aparecem marcados como "Demonstração" e não podem ser comprados. Ao receber estoque, viram anúncio normal.
alter table public.products add column is_showcase boolean not null default false;

create or replace function private.products_showcase_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.stock > 0 then
    new.is_showcase := false;
  end if;
  return new;
end;
$$;

create trigger products_showcase_guard before insert or update of stock, is_showcase on public.products
  for each row execute function private.products_showcase_guard();
