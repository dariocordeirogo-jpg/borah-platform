# BORAH

**Assista. Compre. Venda. Ganhe.** — plataforma brasileira de comércio social: leilões (BORAH LANCES), lives, vídeos, marketplace e afiliados.

Status: **Fase 1 — Fundação** (identidade visual, home, login, perfis e permissões). Leilões, produtos e lojas da home são **demonstrações**.

## Rodar localmente

```bash
npm ci
cp .env.example .env.local   # preencha URL e chave publishable do Supabase
npm run dev                  # http://localhost:3000
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (também checa tipos) |
| `npm run lint` | ESLint |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:e2e` | Testes no navegador (Playwright, desktop 1440 px e celular 375 px) |

Os testes e2e usam o projeto Supabase de desenvolvimento e o usuário `e2e@borah.test`
(ver `docs/TESTING.md`). Em máquinas atrás de proxy, rode com `NODE_USE_ENV_PROXY=1`.

## Documentação

- [CLAUDE.md](CLAUDE.md) — regras de trabalho no repositório
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arquitetura e decisões
- [docs/DATABASE.md](docs/DATABASE.md) — tabelas, RLS e migrations
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — cores, tipografia, componentes
- [docs/TESTING.md](docs/TESTING.md) — testes e critérios de aceite
- [docs/ROADMAP.md](docs/ROADMAP.md) — fases
