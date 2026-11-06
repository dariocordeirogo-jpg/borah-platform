# Testes

Resultado em 2026-11-06, Fase 2 (LIVELANCE MARKET + SELLER):

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Build + tipos | `npm run build`, `npm run typecheck` | ok |
| Lint | `npm run lint` | ok, 0 avisos |
| Unitários | `npm test` | 37/37 |
| Navegador (1440 px e 375 px) | `npm run build:e2e && npm run test:e2e` | 39/39 (5 do fluxo de compra só no desktop) |
| Concorrência no checkout | `npm run test:integration` | 5 disputas pela última unidade: sempre 1 pedido, 0 estoque negativo |
| Segurança do banco (Fase 1) | `supabase/tests/rls_fase1.sql` | 17/17 |
| Motor de pedidos (Fase 2) | `supabase/tests/market_fase2.sql` | 21/21 |

Atrás de proxy (ambiente de nuvem): `NODE_USE_ENV_PROXY=1` nos comandos acima. `build:e2e` desliga o otimizador de imagens
para o servidor de teste servir as fotos direto do Supabase.

## Fluxo de compra coberto de ponta a ponta (`tests/e2e/market.spec.ts`)

1. Vendedor abre a loja, cria produto (com validação), arquivo falso `.png` é recusado, foto JPG enviada.
2. Visitante acha o produto pela busca do cabeçalho, vê preço, estoque e foto carregada.
3. Comprador: "Comprar agora" com 2 unidades → carrinho (contador do cabeçalho) → checkout → cadastra endereço → pedido
   "Aguardando pagamento" → estoque cai de 3 para 1 → cancela → estoque volta a 3.
4. Vendedor vê o pedido cancelado e pausa o produto (limpeza).
5. Comprador sem loja que abre `/seller` vai para `/vender`.

## Outros testes e2e

Marca (nenhuma menção antiga), paleta (sem verde, dourado só em comprar/dar lance), SEO, login, recuperação de senha,
redirecionamentos, links da home, cronômetro, sem rolagem horizontal no celular.

## Não coberto ainda

E-mails reais (SMTP), login Google completo, frete e pagamento (Fases 4+), domínio e deploy.
