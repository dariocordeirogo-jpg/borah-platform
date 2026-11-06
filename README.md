# LIVELANCE

**Tudo acontece ao vivo.** Marketplace brasileiro que reúne três modalidades em uma plataforma:

| Módulo | O que é |
| --- | --- |
| LIVELANCE MARKET | Compra e venda com preço fixo |
| LIVELANCE LIVE | Transmissões ao vivo com chat e produtos vinculados |
| LIVELANCE LEILÕES | Lotes, lances em tempo real, cronômetro e arrematação |
| LIVELANCE SELLER | Central do vendedor |
| LIVELANCE PAY | Pagamentos (só quando houver provedor homologado) |

Domínio pretendido: `livelance.com.br` (ainda não configurado — ver [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).

Status: **Fase 1 — Fundação** concluída e marca migrada para LIVELANCE. Lives, leilões, produtos e lojas da home são **demonstrações**.

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
| `npm run test:e2e` | Testes no navegador (Playwright, 1440 px e 375 px) |

Os testes e2e usam o projeto Supabase de desenvolvimento e o usuário `e2e@livelance.test`
(ver `docs/TESTING.md`). Em máquinas atrás de proxy, rode com `NODE_USE_ENV_PROXY=1`.

## Documentação

- [CLAUDE.md](CLAUDE.md) — regras de trabalho no repositório
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arquitetura e decisões
- [docs/DATABASE.md](docs/DATABASE.md) — tabelas, RLS e migrations
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — marca, cores, tipografia, componentes
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — domínio, Vercel, Supabase Auth, SEO
- [docs/TESTING.md](docs/TESTING.md) — testes e critérios de aceite
- [docs/ROADMAP.md](docs/ROADMAP.md) — fases
- [docs/BRAND_MIGRATION.md](docs/BRAND_MIGRATION.md) — relatório da migração BORAH → LIVELANCE
