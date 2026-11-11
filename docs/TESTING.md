# Testes

Resultado em 2026-11-11, Fase 5 (Indique e ganhe):

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Build + tipos | `npm run build`, `npm run typecheck` | ok |
| Lint | `npm run lint` | ok, 0 avisos |
| Unitários | `npm test` | 83/83 (inclui assinatura igual à da biblioteca oficial da Stripe e links de indicação) |
| Navegador (1440 px e 375 px) | `npm run build:e2e && npm run test:e2e` | 51 ok, 17 pulados no celular de propósito (fluxos de compra, leilão, pagamento e indicação só no desktop) |
| Concorrência | `npm run test:integration` | Checkout: 5 disputas pela última unidade, sempre 1 pedido. Lances: 20 simultâneos, sequência sempre crescente e consistente |
| Segurança do banco (Fase 1) | `supabase/tests/rls_fase1.sql` | 17/17 |
| Motor de pedidos (Fase 2) | `supabase/tests/market_fase2.sql` | 21/21 |
| Motor de leilões (Fase 3) | `supabase/tests/leiloes_fase3.sql` | 36/36 (Fase 3) |
| Pagamentos (Fase 4) | `supabase/tests/pay_fase4.sql` | 47/47 |
| Afiliados (Fase 5) | `supabase/tests/afiliados_fase5.sql` | 22/22 |
| Encerramento automático | `cron.job_run_details` | 5.754 execuções em 4 dias, 0 falhas |

Atrás de proxy (ambiente de nuvem): `NODE_USE_ENV_PROXY=1` nos comandos acima. `build:e2e` desliga o otimizador de imagens
para o servidor de teste servir as fotos direto do Supabase.

## Fluxo de compra coberto de ponta a ponta (`tests/e2e/market.spec.ts`)

1. Vendedor abre a loja, cria produto (com validação), arquivo falso `.png` é recusado, foto JPG enviada.
2. Visitante acha o produto pela busca do cabeçalho, vê preço, estoque e foto carregada.
3. Comprador: "Comprar agora" com 2 unidades → carrinho (contador do cabeçalho) → checkout → cadastra endereço → pedido
   "Aguardando pagamento" → estoque cai de 3 para 1 → cancela → estoque volta a 3.
4. Vendedor vê o pedido cancelado e pausa o produto (limpeza).
5. Comprador sem loja que abre `/seller` vai para `/vender`.

## Leilão em tempo real (`tests/e2e/auctions.spec.ts`)

Vendedor cadastra o lote e abre o leilão (reserva alta, para o teste não gerar inadimplência) → Ana dá lance (valor abaixo
do mínimo é recusado) → Bruno, em outro navegador, cobre → a tela da Ana atualiza sozinha para o novo maior lance e
libera o próximo lance → "Meus lances" mostra "Seu lance foi superado" → visitante vê o leilão e precisa entrar para dar lance.

## Pagamento (`tests/e2e/pay.spec.ts`)

Sem chamar a Stripe: os avisos são assinados com o segredo de desenvolvimento e entram pela rota real
`/api/webhooks/stripe`. Aviso sem assinatura ou com assinatura errada → 400 → aviso `account.updated` ativa a conta da loja
("Recebimentos ativos") → comprador vê a caixa de pagamento ("em configuração" sem chave Stripe) → aviso de pagamento
confirmado marca o pedido como "Pago" (reenvio do mesmo aviso não muda nada) → vendedor vê R$ 150,00, comissão R$ 15,00 e
R$ 135,00 líquidos → reembolso total cancela o pedido e devolve o estoque.

## Indicação (`tests/e2e/affiliates.spec.ts`)

Afiliado entra no programa em `/indique` → painel com link geral e gerador de link (endereço de outro site é recusado) →
link inválido só redireciona, sem cookie, e `?to=` externo cai na home → compradora chega por `/r/<código>?to=/produto/x`,
entra e compra pela tela → comissão "Aguardando pagamento" de R$ 3,00 sobre R$ 100,00 → aviso de pagamento → "Confirmada"
→ reembolso → "Cancelada". Usa a conta de recebimento da loja de teste ativada pelo `pay.spec.ts`.

## Outros testes e2e

Marca (nenhuma menção antiga), paleta (sem verde, dourado só em comprar/dar lance), SEO, login, recuperação de senha,
redirecionamentos, links da home, cronômetro, sem rolagem horizontal no celular.

## Não coberto ainda

E-mails reais (SMTP), login Google completo, frete, domínio e deploy. Chamadas reais à API da Stripe (abrir o Checkout, cadastro da loja) aguardam a chave de teste.
