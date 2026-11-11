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

## Tabelas (Fase 3 — LIVELANCE LEILÕES)

| Tabela | Conteúdo | Quem lê | Quem escreve |
| --- | --- | --- | --- |
| `user_verifications` | CPF (só hash SHA-256 + versão mascarada), celular, data de confirmação por SMS | Dono | Função `submit_verification` |
| `auctions` | Lote (produto da loja), lance inicial, incremento, reserva, horários, maior lance, líder (apelido), resultado | Todos (exceto cancelados) | Só funções |
| `auction_bids` | Lances (apelido mascarado, valor, chave de idempotência) | Todos | Só `place_bid` |
| `auction_events` | Histórico de eventos (criação, lances, prorrogação, encerramento) | Loja dona | Só funções |
| `auction_bans` / `auction_defaults` / `bid_blocks` | Regra de inadimplência | O próprio usuário | Só funções |

Funções:

| Função | O que faz |
| --- | --- |
| `submit_verification(cpf, celular)` | Valida dígitos do CPF, garante um CPF por conta |
| `create_auction(...)` | Reserva 1 unidade do produto e abre o leilão (agora ou programado, 1 h a 7 dias) |
| `place_bid(leilão, valor, chave)` | Trava o leilão, confere verificação/bloqueios/incremento/horário, grava o lance, prorroga 2 min se faltar menos de 2 min (máx. 10) |
| `cancel_auction(leilão)` | Loja cancela só sem lances; estoque volta |
| `confirm_auction_win(leilão, endereço)` | Vencedor cria o pedido em até 48 h |
| `my_auction_status`, `my_bids` | Situação do usuário |
| `private.run_auction_jobs()` (pg_cron, a cada minuto) | Encerra leilões vencidos (vencedor / sem lances / reserva não atingida) e trata arremates não confirmados: perde o lote, banimento daquele lote, lote relançado; 3ª vez → 7 dias sem lances |

Tempo real: `auctions` e `auction_bids` estão na publicação `supabase_realtime`.
Flag `require_phone_sms` (desligada): quando houver provedor de SMS, exige telefone confirmado para dar lance.

Funções em `private` (fora da API): `has_role`, `is_admin`, `handle_new_user`, `set_updated_at`.

## Tabelas (Fase 4 — LIVELANCE PAY)

| Tabela | Conteúdo | Quem lê | Quem escreve |
| --- | --- | --- | --- |
| `store_payment_accounts` | Conta Stripe da loja; `verified` só após aviso assinado `account.updated` | Dono da loja | `register_payout_account` e avisos |
| `payments` | Valor, comissão, líquido (`net_cents`), status, sessão e PaymentIntent | Comprador e loja | Só funções |
| `payment_events` | Avisos recebidos (idempotência) | Ninguém pela API | Só `stripe_ingest_event` |
| `private.payment_settings` | Comissão (bps), tolerância da assinatura, validade da sessão | Fora da API | Migração / SQL |

Funções: `start_order_payment(pedido)`, `attach_checkout_session(pagamento, sessão)`, `register_payout_account(conta)`,
`stripe_ingest_event(payload, assinatura)` (assinatura conferida com o segredo `stripe_webhook_secret` do Vault),
`store_accepts_payments(loja)`, `platform_fee_bps()`. `cancel_order` agora recusa pedido com Pix/boleto em processamento.
Detalhes e configuração: [PAYMENTS.md](PAYMENTS.md).

## Tabelas (Fase 5 — Indique e ganhe)

| Tabela | Conteúdo | Quem lê | Quem escreve |
| --- | --- | --- | --- |
| `affiliates` | Código do afiliado | O próprio | `become_affiliate` |
| `affiliate_clicks` | Cliques por dia (só contador) | O próprio | `track_referral` |
| `affiliate_commissions` | Pedido, base, taxa, comissão, status (pendente → confirmada / cancelada) | O afiliado | `checkout_with_ref` e gatilho no pedido |
| `private.affiliate_settings` | Taxa (300 = 3%) e janela do cookie (30 dias) | Fora da API | Migração / SQL |

`checkout_with_ref(endereço, código)` chama o `checkout` e registra a comissão. Não gera comissão para autoindicação,
indicação da própria loja ou código inválido (a compra segue normalmente). O gatilho `orders_sync_commission` confirma a
comissão quando o pedido é pago e cancela quando o pedido é cancelado ou reembolsado.

## Tabelas (Fase 6 — Vídeos)

| Tabela | Conteúdo | Quem lê | Quem escreve |
| --- | --- | --- | --- |
| `videos` | Loja, produto marcado, arquivo, legenda, status, visualizações, curtidas | Todos (publicado, loja ativa, produto ativo); a loja vê os seus | `create_video`, `remove_video`, contadores |
| `video_likes` | Quem curtiu | O próprio | `toggle_video_like` |

Bucket `product-videos` (público para leitura, 50 MB, mp4/webm/mov; envio e exclusão só na pasta da própria loja).
O arquivo vai direto do navegador ao Storage; `create_video` confere produto da loja, caminho e se o arquivo existe.

## Testes de RLS

`supabase/tests/rls_fase1.sql` roda numa transação com rollback e confere 17 regras
(ex.: usuário A não lê nem altera dados de B, ninguém se dá papel de admin, anônimo não lê perfis).
Resultado em 2026-11-06: **17/17 ok**.

## Usuários de teste

Só no projeto de desenvolvimento: `e2e@livelance.test` (comprador), `e2e-comprador2@livelance.test` (comprador, teste de
concorrência) e `e2e-vendedor@livelance.test` (vendedor, "Loja E2E LIVELANCE"). Senha `Teste12345`.
Antes de produção, remover os três, a loja e os produtos de teste.

Testes SQL: `supabase/tests/rls_fase1.sql` (17/17), `supabase/tests/market_fase2.sql` (21/21) `supabase/tests/leiloes_fase3.sql` (36/36) `supabase/tests/pay_fase4.sql` (47/47) `supabase/tests/afiliados_fase5.sql` (22/22) e `supabase/tests/videos_fase6.sql` (19/19).

## Migrations aplicadas

| Versão | Nome | O que faz |
| --- | --- | --- |
| 20261106122117 | fase1_identidade | Tabelas, RLS, trigger de novo usuário, flags |
| 20261106122133 | fase1_funcoes_privadas | Move funções auxiliares para o schema `private` |
| 20261106133738 | marca_livelance | Atualiza textos das flags e o nome padrão de usuário (não destrutiva) |

| 20261106135733 | fase2_market | Lojas, produtos, fotos, carrinho, pedidos, estoque, funções e bucket |
| 20261106135747 | fase2_indices_fk | Índices das chaves estrangeiras |
| 20261106135914 | fase2_catalogo_publico | Visitantes conseguem ler o catálogo (correção achada no teste) |
| 20261106144634 | fase3_leiloes | Verificação, leilões, lances, inadimplência, pg_cron, tempo real |
| 20261111120010 | fase4_pay | Contas de recebimento, pagamentos, avisos assinados, reembolso |
| 20261111120446 | fase4_loja_recebe | `store_accepts_payments` (público, sem expor a conta) |
| 20261111133258 | fase5_afiliados | Afiliados, cliques, comissões, `checkout_with_ref`, gatilho de status |
| 20261111140455 | fase6_videos | Vídeos, curtidas, bucket `product-videos`, funções |
| 20261111141015 | storage_dono_le_pasta | Dono lê a própria pasta no Storage (sem isso, apagar foto/vídeo não removia o arquivo) |

As duas primeiras ainda citam a marca antiga em comentários e textos: são histórico já aplicado e não são editadas.
