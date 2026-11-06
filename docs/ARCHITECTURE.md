# Arquitetura — LIVELANCE (Fase 1)

| Camada | Tecnologia | Onde |
| --- | --- | --- |
| Interface | Next.js 16 (App Router, Cache Components), React 19, Tailwind 4 | `src/app`, `src/components` |
| Sessão | Supabase Auth via `@supabase/ssr` (cookies) | `src/lib/supabase`, `src/proxy.ts` |
| Acesso a dados da sessão | `getCurrentUser()` | `src/lib/auth.ts` |
| Mutações de login | Server Actions + Zod | `src/app/(auth)/actions.ts`, `src/lib/validation.ts` |
| Banco | Postgres (Supabase), RLS em todas as tabelas | `supabase/migrations` |

## Fluxos de autenticação

- **E-mail e senha:** `signUp` → Supabase envia e-mail de confirmação → link volta em `/auth/callback?code=…` → sessão criada → `/conta`.
- **Google:** `signInWithGoogle` gera a URL do Supabase (`/auth/v1/authorize?provider=google`) → Google → `/auth/callback`.
- **Recuperação de senha:** `/recuperar-senha` → `requestPasswordReset` (resposta igual exista ou não a conta) → e-mail → `/auth/callback?next=/nova-senha` → `updatePassword`.
- **Novo usuário:** o trigger `private.handle_new_user` cria o perfil, dá o papel `buyer` e grava auditoria.
- **Proteção:** o proxy redireciona `/conta` sem sessão para `/entrar` (checagem otimista); a página confere de novo no servidor.
- **Redirecionamento seguro:** `safeNextPath` só aceita caminhos internos (bloqueia open redirect).

## Decisões

- Sessão validada com `auth.getUser()` (consulta o Supabase), não só `getSession()`.
- Cronômetros da home são só de exibição. Na Fase 3, o fim do leilão vem do banco (pg_cron + função `place_bid`).
- Cabeçalhos de segurança básicos em `next.config.ts` (nosniff, frame DENY, referrer, permissions).

## LIVELANCE MARKET + SELLER (Fase 2)

| Parte | Onde |
| --- | --- |
| Consultas (sempre na requisição, com `connection()`) | `src/lib/market/queries.ts` |
| Ações do comprador (carrinho, endereço, pedido, cancelamento) | `src/lib/market/actions.ts` |
| Ações do vendedor (loja, produto, fotos, cancelamento) | `src/app/seller/actions.ts` |
| Validação (Zod), preço em centavos, slug, erros | `src/lib/market/schemas.ts`, `format.ts` |
| Tipos do banco | `src/lib/supabase/database.types.ts` (regenerar após migrations) |
| Páginas | `/market`, `/produto/[id]`, `/loja/[slug]`, `/carrinho`, `/checkout`, `/conta/pedidos`, `/vender`, `/seller/*` |

Regras: o preço e o estoque do pedido vêm do banco no momento do `checkout` (nunca do navegador); um pedido por loja;
frete "a combinar" até a integração de logística; nenhum pagamento real até a Fase 4.

## Marca e SEO

- Nome, slogan, título, descrição e módulos: `src/lib/site.ts` (fonte única).
- `metadataBase`, canonical, Open Graph e Twitter: `src/app/layout.tsx`; imagem de compartilhamento: `src/app/opengraph-image.tsx`.
- `src/app/robots.ts` (bloqueia indexação fora de `https://livelance.com.br`), `src/app/sitemap.ts`, `src/app/manifest.ts` (PWA).
- Redirecionamentos: `/lances` → `/leiloes`; `www.livelance.com.br` → `livelance.com.br`.

## Configuração pendente

Ver [DEPLOYMENT.md](DEPLOYMENT.md).
