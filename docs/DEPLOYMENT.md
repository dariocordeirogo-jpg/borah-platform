# Domínio, publicação e configuração

Nada abaixo foi feito ainda fora do código: o domínio não está registrado por nós, não existe projeto na Vercel
e o Supabase ainda não conhece as URLs de produção. Siga na ordem.

## 1. Domínio

1. Registrar `livelance.com.br` no Registro.br (e, se quiser, `livelance.com` em outro registrador).
2. Na Vercel → projeto → Settings → Domains: adicionar `livelance.com.br` e `www.livelance.com.br`.
3. Configurar o DNS conforme a Vercel indicar (registro A para o apex, CNAME para `www`).
4. O código já redireciona `www.livelance.com.br` → `livelance.com.br` (`next.config.ts`).
   `livelance.com`, se adquirido, pode ser adicionado na Vercel como redirecionamento para `livelance.com.br`.

## 2. Vercel

Variáveis de ambiente (Production e Preview):

| Variável | Produção | Preview |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://elygbieuroidqxkifgou.supabase.co` | igual |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave publishable do projeto | igual |
| `NEXT_PUBLIC_SITE_URL` | `https://livelance.com.br` **só depois do passo 1 funcionar** | URL do preview ou deixar vazio |

`NEXT_PUBLIC_SITE_URL` controla canonical, Open Graph, sitemap e robots. Enquanto não for exatamente
`https://livelance.com.br`, o `robots.txt` bloqueia indexação (evita o Google indexar previews).

## 3. Supabase Auth (painel → Authentication)

- **URL Configuration → Site URL:** `https://livelance.com.br` (até lá, a URL da Vercel).
- **Redirect URLs:** `http://localhost:3000/**`, `https://livelance.com.br/**`, `https://*-<time>.vercel.app/**` (previews).
  Todos os links de e-mail e o Google voltam em `/auth/callback`.
- **Providers → Google:** Client ID e Secret do Google Cloud; no Google, a URI de redirecionamento autorizada é
  `https://elygbieuroidqxkifgou.supabase.co/auth/v1/callback`.
- **Emails → Templates:** colar `supabase/templates/confirmacao.html` (Confirm signup) e
  `supabase/templates/recuperar-senha.html` (Reset password).
- **Emails → SMTP:** remetente próprio (ex.: `nao-responda@livelance.com.br`) antes do lançamento.
- **Attack Protection → Leaked password protection:** ativar (apontado pelo verificador de segurança do Supabase).

## 4. O que ainda não existe e entra quando o módulo for construído

CORS e webhooks (pagamentos, vídeo), URLs de API externas e páginas dinâmicas no sitemap (produtos, lojas, lives, lotes).
