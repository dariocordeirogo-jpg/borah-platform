# Perguntas e respostas

Na página do produto, quem está logado pergunta à loja; só a loja dona do produto responde
(`/seller/perguntas`, com o total sem resposta no painel do vendedor).

- **Visível para todos:** perguntas já respondidas de produtos à venda. Pergunta sem resposta só quem perguntou
  (e a loja) veem.
- **Contato fora da Zexi é recusado** nas perguntas e nas respostas (`private.has_contact`): e-mail, links,
  WhatsApp/Telegram, @perfil e telefone (DDD + 8/9 dígitos, com ou sem separadores). Números de modelo, ano e
  medida continuam permitidos. Motivo: a compra combinada fora da plataforma perde a Compra Garantida.
- **Limites:** 5 a 500 caracteres na pergunta, 2 a 1000 na resposta; 10 perguntas por hora por pessoa; a loja
  não pergunta no próprio produto.
- **Moderação:** a loja (ou a moderação da Zexi) esconde perguntas ofensivas ou fora de contexto (`hide_question`).
- **Avisos:** cada pergunta entra na fila de e-mail da loja (`question.received`) e cada primeira resposta na fila de
  quem perguntou (`question.answered`), em `private.outbox`. A entrega depende do serviço de e-mail da fila.

Banco: `supabase/migrations/20261115130610_perguntas.sql` (tabela `product_questions` com RLS, sem escrita direta;
funções `ask_question`, `answer_question`, `hide_question`).

Testes: `supabase/tests/perguntas.sql`, `tests/unit/questions.test.ts`, `tests/e2e/questions.spec.ts`.
