# Testes

Resultado em 2026-11-06, depois da migração para LIVELANCE:

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Build + tipos | `npm run build` | ok |
| Lint | `npm run lint` | ok, 0 avisos |
| Unitários | `npm test` | 13/13 |
| Navegador (1440 px e 375 px) | `npm run test:e2e` | 30/30 |
| RLS | `supabase/tests/rls_fase1.sql` | 17/17 |
| Marca antiga no código público | `grep -rniE "b[o0]r[aλΛ]h" src public tests` | 0 ocorrências |

## O que os testes e2e cobrem

- Home LIVELANCE: título SEO, slogan, os três modos (Compre agora, Assista e compre, Dê seu lance), aviso de demonstração e seções.
- Nenhuma menção à marca antiga no HTML de 9 páginas.
- `/lances` redireciona para `/leiloes`.
- `robots.txt`, `sitemap.xml`, `manifest.webmanifest` (nome LIVELANCE) e imagem Open Graph (PNG).
- Cronômetro andando, sem rolagem horizontal, todo link interno da home abre.
- `/conta` sem login → `/entrar`; validação do cadastro; senha errada com mensagem genérica.
- Login → conta → sair; `next` externo ignorado.
- Botão do Google aponta para o Supabase com retorno em `/auth/callback`.
- Recuperação de senha responde igual exista ou não a conta; `/nova-senha` sem link volta para `/recuperar-senha`.

## Não coberto ainda

- E-mails reais de confirmação e de recuperação (dependem de SMTP e da Site URL no painel do Supabase).
- Login com Google completo (depende das credenciais do Google no painel).
- Domínio `livelance.com.br` e deploy na Vercel (ainda não configurados).
