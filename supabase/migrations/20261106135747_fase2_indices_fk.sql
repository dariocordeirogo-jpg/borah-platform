-- Índices para chaves estrangeiras apontadas pelo verificador de desempenho.
create index if not exists cart_items_product_idx on public.cart_items (product_id);
create index if not exists order_items_product_idx on public.order_items (product_id);
create index if not exists inventory_movements_order_idx on public.inventory_movements (order_id);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id);
create index if not exists user_roles_granted_by_idx on public.user_roles (granted_by);
