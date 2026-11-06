# Arquitetura — Fase 1

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
- **Novo usuário:** o trigger `private.handle_new_user` cria o perfil, dá o papel `buyer` e grava auditoria.
- **Proteção:** o proxy redireciona `/conta` sem sessão para `/entrar` (checagem otimista); a página confere de novo no servidor.
- **Redirecionamento seguro:** `safeNextPath` só aceita caminhos internos (bloqueia open redirect).

## Decisões

- Sessão validada com `auth.getUser()` (consulta o Supabase), não só `getSession()`.
- Cronômetros da home são só de exibição. Na Fase 3, o fim do leilão vem do banco (pg_cron + função `place_bid`).
- Cabeçalhos de segurança básicos em `next.config.ts` (nosniff, frame DENY, referrer, permissions).

## Configuração pendente no painel do Supabase

1. **Authentication → URL Configuration:** Site URL e Redirect URLs (`http://localhost:3000/**` e a URL da Vercel).
2. **Authentication → Providers → Google:** Client ID e Secret do Google Cloud. Sem isso o botão do Google leva a um erro do Supabase.
3. **Authentication → Emails:** SMTP próprio antes do lançamento (o servidor de e-mail padrão tem limite baixo por hora).
