-- Comissão da Zexi em 10% (1000 bps): cobre a taxa da Stripe (paga pela Zexi) e os 3% de afiliados.
-- Vale para pagamentos iniciados a partir de agora.
update private.payment_settings set platform_fee_bps = 1000 where id;
