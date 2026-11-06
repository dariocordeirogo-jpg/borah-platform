# Testes — Fase 1

Resultado em 2026-11-06:

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Build + tipos | `npm run build` | ok |
| Lint | `npm run lint` | ok, 0 avisos |
| Unitários | `npm test` | 12/12 |
| Navegador (1440 px e 375 px) | `npm run test:e2e` | 20/20 |
| RLS | `supabase/tests/rls_fase1.sql` | 17/17 |

## O que os testes e2e cobrem

- Home com BORAH LANCES em destaque, aviso de demonstração e cronômetro andando.
- Sem rolagem horizontal no celular.
- Todo link interno da home abre (nenhum botão sem destino).
- `/conta` sem login redireciona para `/entrar`.
- Erros de validação no cadastro; senha errada mostra mensagem genérica.
- Login → conta (papel Comprador, CPF não verificado) → sair; `next` externo é ignorado.
- Botão do Google aponta para o Supabase com retorno em `/auth/callback`.

## Não coberto ainda

- Confirmação de e-mail real (depende de SMTP e da Site URL no painel).
- Login com Google completo (depende das credenciais do Google no painel).
