-- Correção: com a chave (store_id, product_id), a API passou a ver store_featured como ligação muitos-para-muitos entre
-- produtos e lojas e a consulta "products → stores" ficou ambígua (listas de produtos vazias).
-- Troca a chave por um id próprio; a combinação loja + produto continua única.
alter table public.store_featured drop constraint store_featured_pkey;
alter table public.store_featured add column id bigint generated always as identity primary key;
alter table public.store_featured add constraint store_featured_store_product_key unique (store_id, product_id);
notify pgrst, 'reload schema';
