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
Calculada na hora, só com números agregados:
- **Vendas:** pedidos pagos, enviados ou entregues (exibido em faixas: "+10", "+50", "+100"…).
- **Entrega no prazo:** entregues nos últimos 12 meses até o prazo prometido + 3 dias de manuseio.
- **Atendimento:** perguntas dos últimos 90 dias respondidas em até 24 h.
- **Nota:** média das avaliações dos produtos da loja.
- **Nível 1 a 5** (termômetro vermelho → verde): média dos indicadores disponíveis (a nota entra a partir de 3
  avaliações). Abaixo de 5 vendas, ou sem indicador, aparece "Loja nova".
- Selos: "Bom atendimento" (≥ 80% respondidas em 24 h) e "Entrega no prazo" (≥ 85%).

Aparece na caixa de compra do produto e na página da loja.

Banco: `supabase/migrations/20261115131538_avaliacoes.sql`. Testes: `supabase/tests/avaliacoes.sql`,
`tests/unit/reviews.test.ts` e o bloco "Avaliações e reputação" em `tests/e2e/questions.spec.ts`.
