# Roadmap

Plano completo: https://claude.ai/artifact/WBDmP5nMpUWFYPPh3GLm6R

| Fase | Entrega | Status |
| --- | --- | --- |
| 1 Fundação | Projeto, design system, home, login (e-mail e Google), perfis, papéis, RLS | Feita (aguardando config do Google e Vercel) |
| 2 Marketplace | Lojas, produtos, busca, carrinho, pedido sem pagamento real | — |
| 3 Leilões | Verificação de CPF/telefone, `place_bid`, anti-sniping, encerramento por pg_cron, regra de inadimplência | — |
| 4 Pagamentos | Provedor com split, Pix, cartão, webhooks, ledger | — |
| 5 Afiliados | Links, cupons, atribuição, comissões | — |
| 6 Vídeos | Feed vertical com produto marcado | — |
| 7 Lives | Transmissão, chat, leilão ao vivo | — |
| 8–10 | Admin, IA, homologação e lançamento | — |

## Regras de leilão já decididas

- Só contas com **CPF e telefone verificados** dão lance.
- Vencedor que não paga: perde o arremate, o produto **volta para o leilão** e ele não pode mais dar lance naquele leilão.
- A partir da **3ª inadimplência**, a conta fica **7 dias** sem poder dar lances.
