# ZEXI LIVE — transmissão (Mux)

O vídeo das lives é transmitido pelo [Mux](https://www.mux.com). A loja transmite do OBS (computador) ou de um app
de celular (RTMP, ex.: Larix Broadcaster); quem assiste recebe o vídeo HLS no player da Zexi (hls.js).

## Como funciona

1. A loja programa a live e, no estúdio (`/seller/lives/<id>`), toca em **Gerar chave de transmissão**.
2. O servidor cria a transmissão no Mux (`POST /video/v1/live-streams`): reprodução pública, baixa latência,
   até 4 h contínuas, **sem gravação** (não gera custo de armazenamento). `passthrough` = id da live.
3. `attach_live_stream` guarda a ligação em `private.live_streams` e põe o link `https://stream.mux.com/<playback>.m3u8`
   na live. Se falhar, a transmissão recém-criada é desligada no Mux.
4. O estúdio mostra o servidor `rtmps://global-live.mux.com:443/app`, a chave (escondida até clicar) e o status
   (aguardando sinal / recebendo vídeo). A **chave nunca é gravada no banco**: o servidor busca no Mux a cada
   abertura do estúdio, só para o dono da loja.
5. A loja toca em **Começar live** quando o vídeo estiver chegando.
6. Ao encerrar (pela loja ou pela moderação), a transmissão é desligada no Mux (`PUT .../disable`) e marcada em
   `private.live_streams.disabled_at`. A chave antiga deixa de aceitar vídeo.

Sem `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET`, o estúdio diz "em configuração" e a loja pode colar um link HLS de outro serviço.

## Player

Lives com link do Mux (`stream.mux.com`) tocam no **Mux Player** (`@mux/mux-player`, modo `ll-live`, carregado só
no navegador). Links HLS de outros serviços continuam no hls.js.

## Configuração

1. Mux → Settings → Access Tokens → gerar token com permissão **Mux Video (Read + Write)** no ambiente certo
   (um ambiente de desenvolvimento para testes e o de produção para o lançamento).
2. Vercel: `MUX_TOKEN_ID` e `MUX_TOKEN_SECRET` (só no servidor).
3. `GET /api/health` mostra `integrations.live: true`.

## Transmitir pelo navegador (Cloudflare Stream)

A loja também pode transmitir **pela câmera do celular ou do computador**, sem OBS. No estúdio, "Transmitir pelo
navegador" cria uma entrada no Cloudflare Stream (WebRTC, atraso abaixo de 1 s):

- Envio (WHIP): o endereço de envio é segredo da loja. Não vai para o banco; o servidor busca na Cloudflare na hora e
  entrega só à tela do dono (`src/components/live/browser-broadcast.tsx`).
- Reprodução (WHEP): o link público `https://customer-…cloudflarestream.com/<id>/webRTC/play` vira o `playback_url` da
  live; o player conecta por WebRTC e tenta de novo a cada 5 s enquanto a loja não liga a câmera.
- Câmera e microfone só são liberados na página do estúdio (`Permissions-Policy` em `next.config.ts`).
- Ao encerrar a live (loja ou moderação) a entrada é apagada na Cloudflare.
- Limites do WebRTC na Cloudflare hoje: sem gravação/replay, sem HLS e sem contagem de espectadores do lado deles
  (o contador da Zexi continua funcionando). Custo: US$ 1 por 1.000 minutos assistidos.

Configuração: token da Cloudflare com permissão **Account → Stream → Edit**; na Vercel, `CLOUDFLARE_API_TOKEN` e
`CLOUDFLARE_ACCOUNT_ID` (só no servidor). `GET /api/health` mostra `integrations.liveBrowser: true`.
Teste: `supabase/tests/live_navegador.sql` e `tests/unit/cloudflare-stream.test.ts`.

## Ponte com TikTok e Instagram

A loja faz a live ao mesmo tempo no próprio perfil e informa o @ no estúdio ("Também ao vivo no TikTok e no
Instagram"). Quem assiste lá pode comentar:

- `ZX123456` (código gerado em **Minha conta → TikTok e Instagram**, `/conta/redes`): vincula o @ à conta Zexi.
  Só quem controla o @ consegue comentar com ele; o código vale 30 min e uma vez.
- `LANCE 150` (ou `lance R$ 1.200,50`): lance no leilão aberto da live, pelo mesmo motor do site
  (`private.place_bid_as`; `place_bid` do site chama o mesmo motor): CPF verificado, incremento mínimo,
  anti-sniping, bloqueios, sem lance duplicado.
- `EU QUERO`: põe o produto em destaque no carrinho (marcado com a live); preço e estoque são conferidos de novo
  no checkout. Bloqueado enquanto há leilão na live.

Comentário de @ não vinculado só aparece no espelho com o aviso para vincular. Pagamento é sempre na Zexi.

**Nada fica gravado:** o espelho dos comentários (`live_social_events`) só é visível com a live no ar e é
apagado quando ela termina. A transmissão também não é gravada (Mux sem gravação; pelo navegador a entrada da
Cloudflare é apagada no fim).

Como funciona por baixo:

- O conector `workers/social-bridge` (Node, fora da Vercel, ex.: Railway) pergunta ao banco quais lives estão
  no ar com @ (`social_bridge_targets`) e repassa cada comentário (`social_bridge_comment`). Toda chamada é
  assinada com HMAC-SHA256 do segredo do Vault `social_bridge_secret`, com horário (até 5 min). Sem assinatura
  válida, nada passa.
- TikTok: `tiktok-live-connector` 2.5.0 (não oficial; lê o chat público da live, com assinatura pela Euler
  Stream). Se o TikTok mudar algo, só a ponte para; o site segue normal.
- Instagram: o banco já aceita `platform = 'instagram'`; falta a entrada dos comentários pelo webhook oficial
  da Meta (`live_comments`), que exige um app aprovado na Meta.

Configuração (dono):

1. Gerar um segredo de 32+ caracteres e salvar no Vault do Supabase como `social_bridge_secret`.
2. Subir `workers/social-bridge` com `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SOCIAL_BRIDGE_SECRET` (o mesmo
   segredo) e, se quiser mais conexões, `EULER_API_KEY`.

Testes: `supabase/tests/ponte_social.sql` e `tests/unit/social-bridge.test.ts`; passos no `tests/e2e/live.spec.ts`.

## Segurança

- Tabela `private.live_streams` sem acesso pela API; leitura e escrita só por `attach_live_stream`,
  `live_stream_ref` (dono da loja ou moderação) e `mark_live_stream_disabled`.
- IDs do Mux validados (`^[A-Za-z0-9]{10,100}$`) antes de virar URL.
- Teste: `supabase/tests/live_mux.sql` e `tests/unit/mux.test.ts`.

## Vendas por live

- O botão de compra dentro da live manda `liveId` junto; o item entra no carrinho com `cart_items.live_id`.
- O banco só aceita a marca se o produto estiver na live (programada ou no ar); senão grava sem marca.
- No checkout o pedido herda a live (`orders.live_id`) — mesmo preço, estoque e pagamento de sempre.
- O estúdio mostra "Vendas desta live" (pedidos pagos e aguardando pagamento).
- Teste: `supabase/tests/live_atribuicao.sql` e o passo de compra em `tests/e2e/live.spec.ts`.

## Quem está assistindo

- Contador "N assistindo" na live e no estúdio, pela presença do Supabase Realtime (canal `live-presence-<id>`).
- Só quem assiste entra na contagem; o estúdio observa. Número aproximado, só para exibição (nada de dinheiro depende dele).

## Avisos do Mux (webhook) e live abandonada

- `POST /api/webhooks/mux` repassa o corpo cru para `mux_ingest_event`, que confere a assinatura `Mux-Signature`
  com o segredo do Vault `mux_webhook_secret`, descarta avisos repetidos e marca `lives.stream_signal`
  (`active` / `idle`). Quem assiste vê "O sinal da loja caiu" enquanto o sinal está parado.
- Aviso de uma transmissão cuja live já saiu do ar (encerrada, cancelada, loja suspensa): o servidor desliga a
  chave no Mux e confirma ao banco com um aviso interno assinado (`zexi.stream_disabled`).
- `private.close_abandoned_lives()` (pg_cron a cada 5 min): encerra live sem sinal há 30 min ou no ar há 8 h e
  cancela live programada há mais de 24 h sem começar. Fica no `audit_logs` como `live.auto_end`.
- Configuração: Mux → Settings → Webhooks → URL `https://www.zexi.com.br/api/webhooks/mux`; copiar o
  *signing secret* para a Vercel (`MUX_WEBHOOK_SECRET`) e para o Vault (`mux_webhook_secret`).
- Testes: `supabase/tests/live_mux_webhook.sql` e `tests/unit/mux-webhook.test.ts`.

## Pendências

- Suspensão de loja: a chave é desligada no próximo aviso que o Mux mandar daquela transmissão.
- Gravação/replay da live (custa armazenamento no Mux) — decidir antes de ligar.
