# ZEXI PAY (Stripe)

Pagamentos com **Stripe Connect**, no modelo em que **a Stripe cuida do risco** (Managed Risk):

- Cada loja tem uma conta conectada criada pela **Accounts v2** (`/v2/core/accounts`), Brasil, com:
  - painel **Express** (`dashboard: "express"`);
  - configuração **merchant** (`card_payments` e `boleto_payments`): a loja vende na própria conta;
  - **taxa da Stripe cobrada da loja** (`fees_collector: "stripe"`);
  - **saldo negativo de responsabilidade da Stripe** (`losses_collector: "stripe"`): a Stripe analisa fraude e
    assume perdas que a loja não pagar.
- Cada pedido vira uma **cobrança direta** na conta da loja (Checkout criado com `Stripe-Account`). A comissão da
  Zexi sai como `application_fee_amount`. Na fatura do cartão aparece o nome da loja.
- Painel Express com Managed Risk está em **prévia pública** e exige a versão de prévia da API
  (`CONNECT_ACCOUNTS_API_VERSION` em `src/lib/pay/stripe.ts`). Só vale para contas novas; o tipo de painel de uma conta não
  muda depois.
- A Zexi **não** pode ser responsável pelos saldos negativos nesta conta Stripe sem a aceitação formal em
  Connect → Platform profile; por isso o modelo anterior (cobrança com destino, conta Express v1) foi trocado.

## Quem decide o quê

| Etapa | Onde | Detalhe |
| --- | --- | --- |
| Valor, comissão e conta de destino | Banco (`start_order_payment`) | Total do pedido; comissão = `private.payment_settings.platform_fee_bps` (padrão 1000 = 10%) |
| Abrir o Checkout | Servidor (`payOrder`) | Na conta da loja, com exatamente os valores do banco; chave de idempotência por pagamento |
| Pedido "Pago" | Banco (`stripe_ingest_event`) | Só com aviso **assinado** pela Stripe e vindo da **conta da loja registrada no pagamento** (campo `account`) |
| Situação da loja | Servidor (`syncPayoutAccount`) + aviso `account.updated` | Pela capacidade v2: vende com `card_payments` ativo, recebe com `payouts` ativo |
| Navegador | — | Nunca decide valor nem status |

Avisos tratados: `checkout.session.completed` (cartão pago, ou Pix/boleto gerado → "processando"),
`checkout.session.async_payment_succeeded` / `_failed`, `checkout.session.expired`, `account.updated`, `charge.refunded`.
Avisos repetidos são ignorados (`payment_events`). Aviso de produção (`livemode`) é ignorado enquanto a flag `payments`
estiver desligada.

Proteções testadas (`supabase/tests/pay_fase4.sql`, 50/50): assinatura errada, replay (aviso com mais de 5 min), payload
alterado, sessão de outro pagamento, sessão ou reembolso vindos de outra conta conectada, valor diferente do combinado (marca para devolução), pagamento de pedido já
cancelado (o servidor reembolsa sozinho), Pix em processamento bloqueia cancelamento, reembolso total cancela o pedido e
devolve o estoque.

## Limitações

- **Um pagamento por loja:** carrinho com duas lojas gera dois pedidos e dois pagamentos (cobrança direta é sempre
  na conta de uma loja só).
- **Pix:** a Accounts v2 ainda não oferece a capacidade de Pix para as lojas; no Checkout aparecem cartão e boleto.
- **Boleto** aparece no Checkout só se estiver ativo na conta da loja.
- Frete continua "a combinar".
- Reembolso parcial não muda o pedido (só o total).

## Configurar (modo de teste primeiro)

1. **Stripe → Modo de teste → Desenvolvedores → Chaves de API:** copie a chave secreta `sk_test_...`.
2. **Stripe → Connect:** ative o Connect. Use um **sandbox** (Stripe → Sandboxes) e, de preferência, uma chave
   restrita (`rk_test_...`) com permissão de escrita em contas v2, Checkout Sessions, reembolsos e login links.
3. **Stripe → Desenvolvedores → Webhooks → Adicionar endpoint:** `https://<domínio>/api/webhooks/stripe`,
   escolhendo **"Eventos de contas conectadas"** (as cobranças acontecem nas contas das lojas), com os eventos:
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
