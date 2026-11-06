# BORAH — instruções para o Claude Code

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

## Next.js 16

Proxy (antigo middleware) em `src/proxy.ts`. `cacheComponents` ligado: qualquer leitura de cookie/sessão
fica dentro de `<Suspense>` e `getCurrentUser()` chama `connection()` antes de ler a sessão.
