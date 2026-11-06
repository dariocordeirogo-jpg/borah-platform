# Banco de dados

Projeto Supabase: ref `elygbieuroidqxkifgou`, região sa-east-1 (nome interno no painel: `borah-platform`, sem efeito para o público).

## Tabelas (Fase 1 — identidade)

| Tabela | Conteúdo | Quem lê | Quem escreve |
| --- | --- | --- | --- |
| `profiles` | Nome, usuário, avatar, bio | Dono e admins | Dono (só `display_name`, `username`, `avatar_url`, `bio`) |
| `user_roles` | Papéis da conta (`buyer`, `seller`, `affiliate`, `creator`, admins) | Dono e admins | Só o servidor (service role) |
| `addresses` | Endereços (CEP com 8 dígitos, UF) | Dono | Dono |
| `audit_logs` | Eventos sensíveis | Admins | Só funções do banco |
| `feature_flags` | Liga/desliga módulos | Todos | Só o servidor |

## Tabelas (Fase 2 — LIVELANCE MARKET + SELLER)

| Tabela | Conteúdo | Quem lê | Quem escreve |
| --- | --- | --- | --- |
| `stores` | Loja (uma por vendedor), nome, slug, descrição | Todos (lojas ativas); dono | Função `create_store`; dono edita nome e descrição |
| `categories` | 12 categorias | Todos | Só migrations |
| `products` | Título, preço (centavos), estoque, condição, status, busca em português (`tsvector`) | Todos (ativos de loja ativa); dono vê os seus | Dono da loja |
| `product_images` | Caminho no Storage (`product-images/{loja}/{produto}/…`) | Com o produto | Dono da loja |
| `cart_items` | Carrinho por usuário | Dono | Dono |
| `orders` / `order_items` | Pedido por loja, total, endereço (cópia), itens com preço da hora | Comprador e loja | **Só** as funções `checkout` e `cancel_order` |
| `inventory_movements` | Histórico de estoque (manual, pedido, cancelamento) | Dono da loja | Gatilho no banco |

Funções expostas (validam `auth.uid()` internamente; o aviso do verificador do Supabase sobre elas é esperado):

| Função | O que faz |
| --- | --- |
| `create_store(nome, slug, descrição)` | Cria a loja e dá o papel `seller` |
| `checkout(endereço)` | Trava os produtos, confere estoque/status/produto próprio, cria um pedido por loja, baixa estoque, esvazia o carrinho |
| `cancel_order(pedido, motivo)` | Comprador ou loja cancelam pedido aguardando pagamento; devolve o estoque |

Storage: bucket público `product-images` (JPG/PNG/WebP, até 5 MB); só o dono envia/apaga na pasta da própria loja.
O servidor confere a assinatura real do arquivo antes de enviar.

Funções em `private` (fora da API): `has_role`, `is_admin`, `handle_new_user`, `set_updated_at`.

## Testes de RLS

`supabase/tests/rls_fase1.sql` roda numa transação com rollback e confere 17 regras
(ex.: usuário A não lê nem altera dados de B, ninguém se dá papel de admin, anônimo não lê perfis).
Resultado em 2026-11-06: **17/17 ok**.

## Usuários de teste

Só no projeto de desenvolvimento: `e2e@livelance.test` (comprador), `e2e-comprador2@livelance.test` (comprador, teste de
concorrência) e `e2e-vendedor@livelance.test` (vendedor, "Loja E2E LIVELANCE"). Senha `Teste12345`.
Antes de produção, remover os três, a loja e os produtos de teste.

Testes SQL: `supabase/tests/rls_fase1.sql` (17/17) e `supabase/tests/market_fase2.sql` (21/21).

## Migrations aplicadas

| Versão | Nome | O que faz |
| --- | --- | --- |
| 20261106122117 | fase1_identidade | Tabelas, RLS, trigger de novo usuário, flags |
| 20261106122133 | fase1_funcoes_privadas | Move funções auxiliares para o schema `private` |
| 20261106133738 | marca_livelance | Atualiza textos das flags e o nome padrão de usuário (não destrutiva) |

| 20261106135733 | fase2_market | Lojas, produtos, fotos, carrinho, pedidos, estoque, funções e bucket |
| 20261106135747 | fase2_indices_fk | Índices das chaves estrangeiras |
| 20261106135914 | fase2_catalogo_publico | Visitantes conseguem ler o catálogo (correção achada no teste) |

As duas primeiras ainda citam a marca antiga em comentários e textos: são histórico já aplicado e não são editadas.
