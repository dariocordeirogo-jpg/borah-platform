# Testes

Resultado em 2026-11-10, Fase 3 (LIVELANCE LEILÕES):

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Build + tipos | `npm run build`, `npm run typecheck` | ok |
| Lint | `npm run lint` | ok, 0 avisos |
| Unitários | `npm test` | 57/57 |
| Navegador (1440 px e 375 px) | `npm run build:e2e && npm run test:e2e` | 42/42 (fluxos de compra e de leilão só no desktop) |
| Concorrência | `npm run test:integration` | Checkout: 5 disputas pela última unidade, sempre 1 pedido. Lances: 20 simultâneos, sequência sempre crescente e consistente |
| Segurança do banco (Fase 1) | `supabase/tests/rls_fase1.sql` | 17/17 |
| Motor de pedidos (Fase 2) | `supabase/tests/market_fase2.sql` | 21/21 |
| Motor de leilões (Fase 3) | `supabase/tests/leiloes_fase3.sql` | 36/36 |
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

## Outros testes e2e

Marca (nenhuma menção antiga), paleta (sem verde, dourado só em comprar/dar lance), SEO, login, recuperação de senha,
redirecionamentos, links da home, cronômetro, sem rolagem horizontal no celular.

## Não coberto ainda

E-mails reais (SMTP), login Google completo, frete e pagamento (Fases 4+), domínio e deploy.
