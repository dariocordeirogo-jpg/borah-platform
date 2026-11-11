# Frete (Correios: PAC e SEDEX)

Enquanto não há contrato com os Correios, o frete é calculado por uma **tabela da LIVELANCE** (zona × peso), no
formato PAC/SEDEX. Quando o contrato sair, só a função de cotação (`private.quote_shipping`) passa a chamar a API
oficial; checkout, pedidos e pagamentos continuam iguais.

## Como funciona

- **Loja:** informa o **CEP de origem** em Painel → Loja e o **peso com embalagem** de cada produto (padrão 500 g,
  máximo 30 kg). Sem CEP de origem, o frete daquela loja fica **a combinar** (como antes).
- **Zona** (a partir dos CEPs de origem e destino): `local` (mesmos 3 primeiros dígitos), `estadual` (mesma UF),
  `regional` (mesma região do país) ou `nacional`. A UF vem das faixas oficiais de CEP dos Correios.
- **Peso:** soma de peso × quantidade dos produtos da loja no pedido; faixas até 300 g, 1, 2, 5, 10, 20 e 30 kg.
- **Checkout:** o comprador vê PAC e SEDEX com preço e prazo por loja e escolhe um serviço para o pedido.
  O banco recalcula o frete ao fechar o pedido (nunca o navegador).
- **Dinheiro:** o frete entra no total pago e vai **inteiro para a loja**. A taxa da LIVELANCE e a comissão de
  indicação são calculadas só sobre os produtos. Cupom: o desconto é sobre os produtos e o pedido nunca fica abaixo de R$ 1,00.

## Tabela

`public.shipping_rates` (leitura pública). A equipe (admin_super / admin_ops) ajusta preço e prazo em
**/admin/frete**; cada alteração fica na auditoria. Os valores iniciais são **de referência** — revisar antes do lançamento.

## Ainda não coberto

- Leilão arrematado: o pedido do arremate continua com frete a combinar.
- Dimensões da caixa (peso cúbico), seguro / valor declarado, aviso de recebimento, etiqueta e rastreio.
- Testes: `supabase/tests/frete.sql` (22 verificações), `tests/unit/shipping.test.ts`, `tests/e2e/shipping.spec.ts`.
