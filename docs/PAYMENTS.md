# LIVELANCE PAY (Stripe)

Pagamentos com **Stripe Connect**. Cada loja tem uma conta conectada (Express, Brasil). Cada pedido vira uma cobrança
com destino à conta da loja (*destination charge*): a Stripe repassa o valor para a loja e a comissão da LIVELANCE
(`application_fee_amount`) fica com a plataforma.

## Quem decide o quê

| Etapa | Onde | Detalhe |
| --- | --- | --- |
| Valor, comissão e conta de destino | Banco (`start_order_payment`) | Total do pedido; comissão = `private.payment_settings.platform_fee_bps` (padrão 1000 = 10%) |
| Abrir o Checkout | Servidor (`payOrder`) | Usa exatamente os valores do banco; chave de idempotência por pagamento |
| Pedido "Pago" | Banco (`stripe_ingest_event`) | Só com aviso **assinado** pela Stripe; assinatura conferida no banco com o segredo do Vault |
| Navegador | — | Nunca decide valor nem status |

Avisos tratados: `checkout.session.completed` (cartão pago, ou Pix/boleto gerado → "processando"),
`checkout.session.async_payment_succeeded` / `_failed`, `checkout.session.expired`, `account.updated`, `charge.refunded`.
Avisos repetidos são ignorados (`payment_events`). Aviso de produção (`livemode`) é ignorado enquanto a flag `payments`
estiver desligada.

Proteções testadas (`supabase/tests/pay_fase4.sql`, 47/47): assinatura errada, replay (aviso com mais de 5 min), payload
alterado, sessão de outro pagamento, valor diferente do combinado (marca para devolução), pagamento de pedido já
cancelado (o servidor reembolsa sozinho), Pix em processamento bloqueia cancelamento, reembolso total cancela o pedido e
devolve o estoque.

## Limitações

- **Um pagamento por loja:** carrinho com duas lojas gera dois pedidos e dois pagamentos. Cobrança única com repasse
  depois (*separate charges and transfers*) exige pedir acesso à Stripe.
- **Pix e boleto** aparecem no Checkout só se estiverem ativos na conta Stripe (Pix pode exigir convite).
- Frete continua "a combinar".
- Reembolso parcial não muda o pedido (só o total).

## Configurar (modo de teste primeiro)

1. **Stripe → Modo de teste → Desenvolvedores → Chaves de API:** copie a chave secreta `sk_test_...`.
2. **Stripe → Connect:** ative o Connect para plataforma/marketplace no Brasil (contas Express).
3. **Stripe → Desenvolvedores → Webhooks → Adicionar endpoint:** `https://<domínio>/api/webhooks/stripe`,
   marcando também **"Eventos de contas conectadas"**, com os eventos:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
   `checkout.session.expired`, `account.updated`, `charge.refunded`. Copie o segredo de assinatura `whsec_...`.
4. **Vercel → variáveis de ambiente (só servidor):** `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`.
5. **Supabase → SQL:** grave o mesmo `whsec_...` no Vault (substitui o segredo de desenvolvimento):

   ```sql
   select vault.update_secret(id, 'whsec_...') from vault.secrets where name = 'stripe_webhook_secret';
   ```

6. Teste: vendedor → **Pagamentos → Conectar conta Stripe**; comprador → pedido → **Pagar** com o cartão de teste
   `4242 4242 4242 4242`.

**Produção:** trocar por `sk_live_` e pelo `whsec_` do endpoint de produção **e** ligar a flag `payments`
(`update feature_flags set enabled = true where key = 'payments'`). Sem a flag, a chave de produção é recusada pelo
servidor e os avisos de produção são ignorados pelo banco.

## Antes de testar com a Stripe de verdade

O teste e2e registra uma conta **falsa** (`acct_1E2ELOJATESTE`) na "Loja E2E LIVELANCE" e a ativa por aviso simulado.
Antes de usar a chave de teste com essa loja, apague a linha para o vendedor conectar uma conta real de teste:

```sql
delete from public.store_payment_accounts where account_id = 'acct_1E2ELOJATESTE';
```
