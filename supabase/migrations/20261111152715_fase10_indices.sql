-- Fase 10: índices nas chaves estrangeiras apontadas pelo advisor de performance.
create index if not exists lives_pinned_product_idx on public.lives (pinned_product_id);
create index if not exists reports_resolved_by_idx on public.reports (resolved_by);
