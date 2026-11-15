# Avaliações e reputação da loja

## Avaliações de produto
- Só quem **recebeu** avalia: pedido entregue, até **60 dias** depois da entrega (dá para editar nesse prazo).
  Em "Minhas compras → pedido" aparece "Avalie sua compra" com estrelas (1 a 5) e comentário opcional.
- Comentário com telefone, e-mail, links ou redes é recusado (mesmo filtro das perguntas).
- A média, o total e a distribuição de estrelas ficam em `product_ratings`, calculados pelo banco a cada avaliação.
  A loja não consegue escrever nem na avaliação nem na média.
- Página do produto: nota ao lado do título, seção "Opiniões do produto" (média, barras por estrela e comentários).
  Cards das vitrines: estrela com a média e o total.
- A moderação esconde avaliação ofensiva (`hide_review`); ela sai da média.

## Reputação da loja (`store_reputation`)
Cor verde, amarela ou vermelha a partir das 5 primeiras vendas. Regra completa em `docs/REGRAS.md`.
Junto com a cor: vendas (em faixas: "+10", "+50"…), atendimento (perguntas respondidas em até 24 h) e a nota média.
Selos: "Bom atendimento" (≥ 80% respondidas em 24 h) e "Entrega no prazo" (até 10% de envios atrasados, com 5+ vendas).

Aparece na caixa de compra do produto, na página da loja e no painel do vendedor (com as regras).

Banco: `supabase/migrations/20261115131538_avaliacoes.sql`. Testes: `supabase/tests/avaliacoes.sql`,
`tests/unit/reviews.test.ts` e o bloco "Avaliações e reputação" em `tests/e2e/questions.spec.ts`.
