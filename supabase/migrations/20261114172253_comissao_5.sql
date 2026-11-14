-- Lançamento: comissão da Zexi em 5% (500 bps). Vale para pagamentos iniciados a partir de agora;
-- os já criados mantêm a comissão calculada no momento em que foram iniciados.
update private.payment_settings set platform_fee_bps = 500 where id;
