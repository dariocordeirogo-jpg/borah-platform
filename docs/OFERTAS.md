# Ofertas e ofertas relâmpago

Página pública: `/ofertas`, com quatro abas: "Todas as ofertas", "Ofertas relâmpago", "30% ou mais" e "Até R$ 50".
Ela tem filtro por categoria e mostra primeiro os maiores descontos. Na página inicial, a vitrine "Ofertas relâmpago"
aparece quando há alguma no ar; quando não há, aparece "Ofertas do dia".

Banco: `supabase/migrations/20261115173016_ofertas.sql`. Teste: `supabase/tests/ofertas.sql`.

- `products.discount_pct`: desconto calculado pelo banco a partir do preço "de" (`compare_at_cents`) e do preço "por".
- `flash_deals`: oferta relâmpago agendada pela loja em **Painel do vendedor → Ofertas relâmpago** (`/seller/ofertas`).
  - Dura de 1 a 24 horas, começa em até 7 dias, com pelo menos 5% de desconto e uma por produto.
  - No início, o banco troca o preço do produto e o preço antigo vira o "de". No fim (agendador `zexi-flash-deals`, a
    cada minuto), o preço normal volta. Se a loja mudou o preço no meio da oferta, a escolha dela é mantida.
  - O pedido continua usando o preço do produto, então o valor é sempre decidido pelo banco.
  - `create_flash_deal` e `cancel_flash_deal` valem só para a dona da loja. O visitante vê só as ofertas agendadas e
    ativas.
