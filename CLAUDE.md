# Zexi — instruções para o Claude Code

@AGENTS.md

## Regras do projeto (do Documento Master)

- O backend é a fonte de verdade. Lance, estoque, pedido, comissão e dinheiro **nunca** são decididos no navegador.
- Regras críticas ficam em funções SQL transacionais no Postgres; RLS ligado em **toda** tabela nova.
- Dinheiro sempre em **centavos inteiros**; horários em UTC (exibidos em America/Sao_Paulo).
- Nada de segredo no frontend: só `NEXT_PUBLIC_SUPABASE_URL` e a chave **publishable**. Service role / secret key só no servidor.
- Funções auxiliares de banco ficam no schema `private` (não exposto pela API).
- Não criar botões sem destino: o que ainda não existe aponta para uma página "Em breve" com a fase.
- Dados de demonstração ficam em `src/lib/demo-data.ts` e são sempre marcados como "Demonstração" na tela.
- Uma fase só fecha com build, lint, testes unitários, e2e e o teste de RLS (`supabase/tests/`) passando.
- Toda migration aplicada no Supabase precisa existir em `supabase/migrations/` com o mesmo conteúdo.
- Marca: o nome público é **Zexi** (slogan "Tudo acontece ao vivo."). Nome, slogan, SEO e módulos vêm de `src/lib/site.ts`.
  As marcas antigas (BORAH, LIVELANCE) só podem aparecer em migrations já aplicadas, no relatório
  `docs/BRAND_MIGRATION.md`, nos e-mails/loja das contas de teste (`@livelance.test`, "Loja E2E LIVELANCE") e no
  tempero interno do hash de CPF (não pode mudar).
- Logo: só os arquivos de `public/brand/` (vetorizados da arte original); nunca redesenhar nem digitar o logo como texto.
- Cores: grafite `#0F1115` + branco; laranja Zexi `#FF4D2D` em botões, links, ponto AO VIVO e selos.
  Dourado só em botões de comprar/dar lance; verde só em status.
- Módulos: ZEXI MARKET (`/market`), ZEXI LIVE (`/ao-vivo`), ZEXI LEILÕES (`/leiloes`), ZEXI SELLER (`/vender`), ZEXI PAY.

## Next.js 16

Proxy (antigo middleware) em `src/proxy.ts`. `cacheComponents` ligado: qualquer leitura de cookie/sessão
fica dentro de `<Suspense>` e `getCurrentUser()` chama `connection()` antes de ler a sessão.
