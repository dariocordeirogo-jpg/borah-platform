# IA da Zexi (Claude)

Três usos, todos com a decisão final nas mãos de uma pessoa:

| Recurso | Onde | O que a IA faz | Quem decide |
| --- | --- | --- | --- |
| Descrição com IA | Cadastro/edição do produto (botão "Escrever com IA") | Lê título, categoria, condição e até 3 fotos e escreve um rascunho honesto (sem inventar especificações) | O vendedor revisa e salva |
| Busca inteligente | `/market` ("Buscar com IA") | Transforma "tênis de corrida usado até 300" em termos + categoria + faixa de preço + condição + ordem | O comprador vê os filtros e pode limpar |
| Triagem de denúncias | `/admin/denuncias` ("Analisar com IA") | Sugere gravidade, recomendação (agir/descartar/revisar) e o porquê | A equipe de moderação |

## Como funciona

- Modelo: **Claude Opus 5.5** (`claude-opus-5-5`), com saída estruturada (JSON validado por esquema Zod) e
  esforço baixo para descrição e busca, médio para triagem.
- Recusa de segurança: fallback automático da API (`fallbacks: "default"`); se ainda assim recusar, a tela segue sem IA.
- Texto e fotos dos usuários entram como **dados**; as instruções dizem para nunca seguir comandos contidos neles.
- **Cota diária por pessoa** no banco (`ai_take_quota`): 30 descrições, 60 buscas e 300 triagens (só equipe).
- Flag `ai` no banco desliga tudo na hora.
- Sem `ANTHROPIC_API_KEY`, a IA aparece como "em configuração" e o site funciona normalmente (a busca inteligente some).

## Configurar

1. Crie uma chave em console.anthropic.com (Settings → API keys).
2. Vercel → variáveis de ambiente (só servidor): `ANTHROPIC_API_KEY`.
3. Opcional: limite de gastos mensal no Console da Anthropic.

## Custo

Cobrança por uso (Claude Opus 5.5: US$ 4 por milhão de tokens de entrada e US$ 20 por milhão de saída). Uma descrição com
3 fotos e uma triagem com fotos são as chamadas mais caras; busca é a mais barata. Antes de liberar para todos, vale medir
o custo real de uma amostra e, se fizer sentido, trocar a busca por um modelo menor.
