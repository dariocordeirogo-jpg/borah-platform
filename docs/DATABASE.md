# Banco de dados

Projeto Supabase: ref `elygbieuroidqxkifgou`, região sa-east-1 (nome interno no painel: `borah-platform`, sem efeito para o público).

## Tabelas (Fase 1)

| Tabela | Conteúdo | Quem lê | Quem escreve |
| --- | --- | --- | --- |
| `profiles` | Nome, usuário, avatar, bio | Dono e admins | Dono (só `display_name`, `username`, `avatar_url`, `bio`) |
| `user_roles` | Papéis da conta (`buyer`, `seller`, `affiliate`, `creator`, admins) | Dono e admins | Só o servidor (service role) |
| `addresses` | Endereços (CEP com 8 dígitos, UF) | Dono | Dono |
| `audit_logs` | Eventos sensíveis | Admins | Só funções do banco |
| `feature_flags` | Liga/desliga módulos | Todos | Só o servidor |

Funções em `private` (fora da API): `has_role`, `is_admin`, `handle_new_user`, `set_updated_at`.

## Testes de RLS

`supabase/tests/rls_fase1.sql` roda numa transação com rollback e confere 17 regras
(ex.: usuário A não lê nem altera dados de B, ninguém se dá papel de admin, anônimo não lê perfis).
Resultado em 2026-11-06: **17/17 ok**.

## Usuário de teste

`e2e@livelance.test` existe só no projeto de desenvolvimento, para os testes e2e. Remover antes de produção:

```sql
delete from auth.users where email = 'e2e@livelance.test';
```

## Migrations aplicadas

| Versão | Nome | O que faz |
| --- | --- | --- |
| 20261106122117 | fase1_identidade | Tabelas, RLS, trigger de novo usuário, flags |
| 20261106122133 | fase1_funcoes_privadas | Move funções auxiliares para o schema `private` |
| 20261106133738 | marca_livelance | Atualiza textos das flags e o nome padrão de usuário (não destrutiva) |

As duas primeiras ainda citam a marca antiga em comentários e textos: são histórico já aplicado e não são editadas.
