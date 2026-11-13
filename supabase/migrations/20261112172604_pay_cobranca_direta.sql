-- ZEXI PAY: cobranças diretas na conta da loja (Stripe Connect com Managed Risk).
-- A sessão do Checkout e o pagamento passam a existir na conta conectada da loja. Os avisos chegam
-- com o campo "account" (a conta onde aconteceram) e só valem se for a conta registrada no pagamento.

create or replace function private.apply_checkout_session_v2(_s jsonb, _type text, _account text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _ref text := _s ->> 'client_reference_id';
  _p public.payments;
  _order public.orders;
  _paid boolean;
begin
  if _ref is null or _ref !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or coalesce(_s -> 'metadata' ->> 'payment_id', '') <> _ref then
    return jsonb_build_object('result', 'unknown_payment');
  end if;
  select * into _p from public.payments where id = _ref::uuid for update;
  if _p.id is null then return jsonb_build_object('result', 'unknown_payment'); end if;
  -- A sessão precisa ter acontecido na conta da loja registrada neste pagamento
  if _account is distinct from _p.destination_account then
    return jsonb_build_object('result', 'account_mismatch');
  end if;
  if _p.checkout_session_id is not null and _p.checkout_session_id <> (_s ->> 'id') then
    return jsonb_build_object('result', 'session_mismatch');
  end if;
  if _p.checkout_session_id is null and (_s ->> 'id') ~ '^cs_(test|live)_[A-Za-z0-9]+$' then
    update public.payments set checkout_session_id = _s ->> 'id' where id = _p.id;
  end if;

  _paid := (_type = 'checkout.session.completed' and _s ->> 'payment_status' = 'paid')
           or _type = 'checkout.session.async_payment_succeeded';

  if _paid then
    if _p.status in ('succeeded', 'refunded') then return jsonb_build_object('result', 'already_paid'); end if;
    if (_s ->> 'amount_total')::bigint is distinct from _p.amount_cents or lower(_s ->> 'currency') <> _p.currency then
      update public.payments set status = 'failed', failure_reason = 'amount_mismatch', needs_refund = true,
        payment_intent_id = coalesce(payment_intent_id, _s ->> 'payment_intent')
      where id = _p.id;
      return jsonb_build_object('result', 'amount_mismatch', 'action', 'refund',
        'payment_intent', _s ->> 'payment_intent', 'account', _p.destination_account);
    end if;

    select * into _order from public.orders where id = _p.order_id for update;
    if _order.status = 'pending_payment'
       and not exists (select 1 from public.payments x where x.order_id = _p.order_id and x.status = 'succeeded') then
      update public.payments set status = 'succeeded', paid_at = now(), failure_reason = null,
        payment_intent_id = _s ->> 'payment_intent'
      where id = _p.id;
      update public.orders set status = 'paid' where id = _p.order_id;
      insert into public.audit_logs (actor_id, action, entity, entity_id, data)
      values (null, 'order.paid', 'order', _p.order_id::text, jsonb_build_object('payment_id', _p.id, 'amount_cents', _p.amount_cents));
      return jsonb_build_object('result', 'paid');
    end if;
    -- Pagou um pedido que não aceita mais pagamento (cancelado ou já pago): devolver
    update public.payments set status = 'failed', failure_reason = 'order_not_payable', needs_refund = true,
      payment_intent_id = _s ->> 'payment_intent'
    where id = _p.id;
    return jsonb_build_object('result', 'order_not_payable', 'action', 'refund',
      'payment_intent', _s ->> 'payment_intent', 'account', _p.destination_account);
  end if;

  if _type = 'checkout.session.completed' then  -- Pix/boleto gerado, aguardando
    if _p.status = 'created' then
      update public.payments set status = 'processing', payment_intent_id = _s ->> 'payment_intent' where id = _p.id;
    end if;
    return jsonb_build_object('result', 'processing');
  elsif _type = 'checkout.session.async_payment_failed' then
    if _p.status in ('created', 'processing') then
      update public.payments set status = 'failed', failure_reason = 'async_payment_failed' where id = _p.id;
    end if;
    return jsonb_build_object('result', 'failed');
  elsif _type = 'checkout.session.expired' then
    if _p.status in ('created', 'processing') then
      update public.payments set status = 'expired' where id = _p.id;
    end if;
    return jsonb_build_object('result', 'expired');
  end if;
  return jsonb_build_object('result', 'ignored');
end $$;

-- Reembolso total (charge.refunded) na conta da loja
create or replace function private.apply_refund_v2(_c jsonb, _account text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _p public.payments;
  _status public.order_status;
begin
  if not coalesce((_c ->> 'refunded')::boolean, false) then return jsonb_build_object('result', 'partial_refund_ignored'); end if;
  select * into _p from public.payments
  where payment_intent_id = _c ->> 'payment_intent' and destination_account = _account for update;
  if _p.id is null then return jsonb_build_object('result', 'unknown_payment'); end if;
  if _p.status = 'refunded' then return jsonb_build_object('result', 'already_refunded'); end if;
  update public.payments set status = case when status = 'succeeded' then 'refunded'::public.payment_status else status end,
    refunded_at = now(), needs_refund = false
  where id = _p.id;
  if _p.status = 'succeeded' then
    select status into _status from public.orders where id = _p.order_id for update;
    if _status = 'paid' then
      perform private.cancel_order_with_restock(_p.order_id, 'Pagamento reembolsado');
    end if;
    insert into public.audit_logs (actor_id, action, entity, entity_id) values (null, 'order.refunded', 'order', _p.order_id::text);
  end if;
  return jsonb_build_object('result', 'refunded');
end $$;

create or replace function public.stripe_ingest_event(_payload text, _signature text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  _evt jsonb;
  _id text;
  _type text;
  _live boolean;
  _account text;
  _res jsonb;
begin
  if length(_payload) > 524288 then raise exception 'payload_too_large' using errcode = 'P0001'; end if;
  if not private.stripe_signature_ok(_payload, _signature) then
    raise exception 'invalid_signature' using errcode = '28000';
  end if;
  _evt := _payload::jsonb;
  _id := _evt ->> 'id';
  _type := _evt ->> 'type';
  _live := coalesce((_evt ->> 'livemode')::boolean, false);
  _account := _evt ->> 'account';  -- conta conectada onde o evento aconteceu (cobrança direta)
  if _id is null or _type is null then raise exception 'invalid_event' using errcode = 'P0001'; end if;

  insert into public.payment_events (event_id, type, livemode) values (_id, _type, _live) on conflict do nothing;
  if not found then return jsonb_build_object('duplicate', true); end if;

  -- Produção só com autorização explícita (flag payments)
  if _live and not coalesce((select enabled from public.feature_flags where key = 'payments'), false) then
    _res := jsonb_build_object('result', 'livemode_disabled');
  elsif _type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded',
                  'checkout.session.async_payment_failed', 'checkout.session.expired') then
    _res := private.apply_checkout_session_v2(_evt -> 'data' -> 'object', _type, _account);
  elsif _type = 'account.updated' then
    _res := private.apply_account(_evt -> 'data' -> 'object');
  elsif _type = 'charge.refunded' then
    _res := private.apply_refund_v2(_evt -> 'data' -> 'object', _account);
  else
    _res := jsonb_build_object('result', 'ignored');
  end if;

  update public.payment_events set result = _res ->> 'result' where event_id = _id;
  return _res || jsonb_build_object('duplicate', false);
end $$;
revoke execute on function public.stripe_ingest_event(text, text) from public;
grant execute on function public.stripe_ingest_event(text, text) to anon, authenticated;

drop function private.apply_checkout_session(jsonb, text);
drop function private.apply_refund(jsonb);
revoke execute on function private.apply_checkout_session_v2(jsonb, text, text), private.apply_refund_v2(jsonb, text)
  from public, anon, authenticated;
