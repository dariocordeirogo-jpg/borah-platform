-- Anúncio importado de outro site: guarda o link de origem (rastreabilidade e atendimento a denúncias).
alter table public.products add column imported_from text
  check (imported_from is null or (length(imported_from) <= 600 and imported_from ~ '^https?://'));
comment on column public.products.imported_from is 'Link do anúncio de origem quando o produto foi importado de outro site pela própria loja.';
