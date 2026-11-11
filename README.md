# LIVELANCE

**Tudo acontece ao vivo.** Marketplace brasileiro que reúne três modalidades em uma plataforma:

| Módulo | O que é |
| --- | --- |
| LIVELANCE MARKET | Compra e venda com preço fixo |
| LIVELANCE LIVE | Transmissões ao vivo com chat e produtos vinculados |
| LIVELANCE LEILÕES | Lotes, lances em tempo real, cronômetro e arrematação |
| LIVELANCE SELLER | Central do vendedor |
| LIVELANCE PAY | Pagamentos pela Stripe Connect, com a comissão retida automaticamente |

Domínio pretendido: `livelance.com.br` (ainda não configurado — ver [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).

Status: **Fase 10 — Homologação e lançamento** preparada: checklist em [docs/LAUNCH.md](docs/LAUNCH.md), `/api/health`, CI no GitHub Actions, rascunhos de Termos e Privacidade e script de limpeza dos dados de teste. Nada foi publicado em produção. Antes, **Fase 9 — IA** construída: descrição de produto com IA, busca inteligente e triagem de denúncias com o Claude (falta a chave `ANTHROPIC_API_KEY`; ver [docs/AI.md](docs/AI.md)). Antes, **Fase 8 — Admin**: denúncias, moderação (produto, vídeo, live, chat), suspensão de lojas, pedidos e números da plataforma, tudo auditado. Antes, **Fase 7 — LIVELANCE LIVE**: lives programadas, chat em tempo real com moderação, produto em destaque, leilão relâmpago e player HLS (falta escolher o serviço de transmissão). Antes, **Fase 6 — Vídeos**: vendedor publica vídeos curtos com produto marcado, feed vertical que toca sozinho, curtir e "Comprar agora" sem sair do vídeo. Antes, **Fase 5 — Indique e ganhe**: link de indicação `/r/<código>`, venda atribuída no banco e comissão de 3% (paga pela plataforma). Antes, **Fase 4 — LIVELANCE PAY** (sobre MARKET, SELLER e LEILÕES): Stripe Connect, pagamento do pedido pelo Checkout, avisos assinados conferidos no banco, comissão de 10% e página de recebimentos do vendedor. Falta ligar a chave de **teste** da Stripe (ver [docs/PAYMENTS.md](docs/PAYMENTS.md)); nenhum pagamento real. 

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
| `npm run test:e2e` | Testes no navegador (Playwright, 1440 px e 375 px); antes, `npm run build:e2e` |
| `npm run test:integration` | Concorrência no checkout contra o banco de desenvolvimento |
| `npm run typecheck` | Gera os tipos de rotas do Next e roda o TypeScript |

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
- [docs/LAUNCH.md](docs/LAUNCH.md) — checklist de lançamento
- [docs/LIVE.md](docs/LIVE.md) — transmissão das lives (Mux)
- [docs/BRAND_MIGRATION.md](docs/BRAND_MIGRATION.md) — relatório da migração BORAH → LIVELANCE
