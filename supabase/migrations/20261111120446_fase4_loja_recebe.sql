-- Fase 4: loja aceita pagamento online? (público, sem expor a conta Stripe)
create function public.store_accepts_payments(_store_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.store_payment_accounts
    where store_id = _store_id and verified and charges_enabled
  )
$$;
grant execute on function public.store_accepts_payments(uuid) to anon, authenticated;
