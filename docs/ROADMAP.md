# Roadmap

Plano completo: https://claude.ai/artifact/WBDmP5nMpUWFYPPh3GLm6R

| Fase | Entrega | Status |
| --- | --- | --- |
| 1 Fundação | Projeto, design system, home, login (e-mail e Google), perfis, papéis, RLS | Feita |
| 1.1 Marca LIVELANCE | Nova marca, logo, SEO, PWA, recuperação de senha, módulos MARKET/LIVE/LEILÕES/SELLER | Feita (aguardando domínio, Vercel e config do Supabase) |
| 2 LIVELANCE MARKET + SELLER | Lojas, produtos com fotos, busca, carrinho, checkout, pedidos sem pagamento real, painel do vendedor | Feita |
| 3 LIVELANCE LEILÕES | Verificação de CPF/telefone, `place_bid`, anti-sniping, encerramento por pg_cron, regra de inadimplência, tempo real | Feita (SMS e parecer jurídico pendentes) |
| 4 LIVELANCE PAY | Stripe Connect (destination charge + comissão), Checkout com cartão/Pix/boleto, webhooks assinados, reembolso | Construída (falta chave de teste da Stripe; ver docs/PAYMENTS.md) |
| 5 Afiliados (Indique e ganhe) | Link `/r/<código>`, cookie de 30 dias, atribuição no checkout, comissão de 3% que acompanha o pedido, painel do afiliado | Construída (cupons e saque pendentes) |
| 6 Vídeos | Feed vertical com produto marcado, curtidas, visualizações, envio direto ao Storage | Construída (moderação pelo admin na Fase 8) |
| 7 LIVELANCE LIVE | Programação, chat em tempo real com moderação, destaque, leilão relâmpago, player HLS | Construída (falta o serviço de transmissão) |
| 8 Admin | Denúncias, moderação, lojas, pedidos, números da plataforma, papéis da equipe | Construída |
| 9–10 | IA, homologação e lançamento | — |

## Regras de leilão já decididas

- Só contas com **CPF e telefone verificados** dão lance.
- Vencedor que não paga: perde o arremate, o produto **volta para o leilão** e ele não pode mais dar lance naquele leilão.
- A partir da **3ª inadimplência**, a conta fica **7 dias** sem poder dar lances.
