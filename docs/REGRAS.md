# Regras da Zexi: contato oculto, reclamações e reputação

Banco: `supabase/migrations/20261115165746_regras_contato_reputacao.sql`. Testes: `supabase/tests/regras.sql`
(contato, reclamações e cores), `supabase/tests/perguntas.sql`, `supabase/tests/avaliacoes.sql`,
`tests/unit/complaints.test.ts`, `tests/unit/reviews.test.ts` e `tests/e2e/questions.spec.ts`.

## 1. Proibido trocar contato fora da plataforma
Telefone, e-mail, links e redes sociais são proibidos **de qualquer forma**. O **banco** oculta o trecho
automaticamente (vira `[contato oculto]`) e o site **avisa da proibição** (`ContactWarning`).

- Onde vale (gatilho `mask_contact_columns` ao gravar): título e descrição do produto, nome e descrição da loja,
  título e descrição da live, título do leilão, legenda de vídeo, chat da live, comentários vindos do TikTok e do
  Instagram, perguntas e respostas, avaliações, nome e bio do perfil, detalhes da reclamação.
- O que é ocultado (`private.mask_contact`):
  - e-mail, inclusive "fulano arroba gmail ponto com";
  - links e domínios (`www.`, `http`, `.com`, `.com.br`…);
  - telefone: 8 ou mais algarismos seguidos, com ou sem espaço, ponto, traço, parênteses ou +55;
  - número escrito por extenso (7 ou mais algarismos: "nove nove oito…");
  - @perfil;
  - WhatsApp/whats/wpp/zap, Telegram, Instagram/insta, Facebook, TikTok, Twitter, Kwai, LinkedIn, Discord, YouTube,
    Messenger, Signal;
  - convites como "meu número", "seu e-mail", "me chama", "me liga", "chama no privado".
- O que **não** é ocultado: modelo, ano, medida e preço ("CB 500 2020, aro 17", "R$ 1.299,90").
- Efeito colateral conhecido: códigos com 8+ algarismos (EAN, códigos internos) e nomes com essas palavras
  (ex.: "Zap") também são ocultados. Textos gravados antes da regra não foram alterados.
- O site pergunta ao banco (`contact_hidden`) se algo foi ocultado, para mostrar o aviso.

## 2. Reclamações (`order_complaints`)
- O comprador abre pela página do pedido (`open_complaint`), quando o pedido está pago ou enviado, ou até
  30 dias depois da entrega. É uma reclamação por pedido, e motivos fixos.
- A loja é avisada por e-mail e vê as reclamações abertas em **Vendas**. O comprador (ou a equipe) encerra a
  reclamação (`resolve_complaint`). A linha do tempo do pedido registra a abertura e o encerramento.
- Ninguém grava direto na tabela (RLS: só leem o comprador, a loja e a equipe).

## 3. Reputação verde, amarela e vermelha (`store_reputation`)
- Começa a valer **depois das 5 primeiras vendas** (pedidos pagos). Antes disso aparece "Loja nova".
- Indicadores (fração das vendas do período):
  - **reclamações**: limite 10%. Uma reclamação resolvida em até 48 horas não pesa;
  - **cancelamentos pela loja** (a loja cancelou e devolveu uma venda paga): limite 5%;
  - **envios atrasados** (despachado mais de 3 dias depois do pagamento, ou ainda não despachado): limite 20%.
- **Vermelha** se qualquer indicador passar do limite. **Amarela** se algum passar da metade do limite (5%, 2,5%,
  10%). Nos outros casos, **verde**.
- Período: o último ano. Para quem vendeu 101 ou mais nos últimos 60 dias, contam só esses 60 dias (mesma ideia dos
  grandes marketplaces).
- Todos os valores ficam em `private.reputation_settings`: `min_sales`, `complaint_limit`, `cancel_limit`,
  `delay_limit`, `warn_ratio`, `handling_days`, `quick_resolve_hours`, `window_days`, `short_window_days` e
  `short_window_min_sales`. Os textos da tela estão em `REPUTATION_RULES` (`src/lib/reviews/format.ts`).
