# Roadmap

Plano completo: https://claude.ai/artifact/WBDmP5nMpUWFYPPh3GLm6R

| Fase | Entrega | Status |
| --- | --- | --- |
| 1 Fundação | Projeto, design system, home, login (e-mail e Google), perfis, papéis, RLS | Feita |
| 1.1 Marca Zexi | Nova marca, logo, SEO, PWA, recuperação de senha, módulos MARKET/LIVE/LEILÕES/SELLER | Feita (aguardando domínio, Vercel e config do Supabase) |
| 2 ZEXI MARKET + SELLER | Lojas, produtos com fotos, busca, carrinho, checkout, pedidos sem pagamento real, painel do vendedor | Feita |
| 3 ZEXI LEILÕES | Verificação de CPF/telefone, `place_bid`, anti-sniping, encerramento por pg_cron, regra de inadimplência, tempo real | Feita (SMS e parecer jurídico pendentes) |
| 4 ZEXI PAY | Stripe Connect (destination charge + comissão), Checkout com cartão/Pix/boleto, webhooks assinados, reembolso | Construída (falta chave de teste da Stripe; ver docs/PAYMENTS.md) |
| 5 Afiliados (Indique e ganhe) | Link `/r/<código>`, cookie de 30 dias, atribuição no checkout, comissão de 3% que acompanha o pedido, painel do afiliado | Construída (cupons e saque pendentes) |
| 6 Vídeos | Feed vertical com produto marcado, curtidas, visualizações, envio direto ao Storage | Construída (moderação pelo admin na Fase 8) |
| 7 ZEXI LIVE | Programação, chat em tempo real com moderação, destaque, leilão relâmpago, player HLS | Construída; transmissão pelo Mux (ver docs/LIVE.md) |
| 8 Admin | Denúncias, moderação, lojas, pedidos, números da plataforma, papéis da equipe | Construída |
| 9 IA | Descrição com IA, busca inteligente, triagem de denúncias (Claude), cota diária | Construída (falta a chave da API) |
| Pós-lançamento: cupons | Cupom da loja (% ou R$), compra mínima, limite de usos, validade, um uso por comprador, devolvido se o pedido for cancelado; desconto sai da loja e as comissões usam o total com desconto | Construída |
| Pós-lançamento: frete | Tabela zona × peso no formato PAC/SEDEX, CEP de origem da loja, peso do produto, escolha no checkout, ajuste em /admin/frete; taxa e comissão sem o frete | Construída (API dos Correios quando houver contrato) |
| Pós-lançamento: player Mux | Mux Player nas lives transmitidas pelo Mux (baixa latência); outros links HLS seguem no hls.js | Construída |
| 10 Homologação e lançamento | Health check, cabeçalhos de segurança, CI, Termos/Privacidade (rascunho LGPD), script de limpeza, checklist | Construída (lançamento depende dos itens em docs/LAUNCH.md) |

## Regras de leilão já decididas

- Só contas com **CPF e telefone verificados** dão lance.
- Vencedor que não paga: perde o arremate, o produto **volta para o leilão** e ele não pode mais dar lance naquele leilão.
- A partir da **3ª inadimplência**, a conta fica **7 dias** sem poder dar lances.
