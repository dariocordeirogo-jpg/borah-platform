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

## Pendências

- Suspensão de loja cancela as lives no banco, mas não desliga as transmissões no Mux (só o encerramento de uma
  live desliga). Baixo risco: a live cancelada some do site; tratar com webhook do Mux se necessário.
- Gravação/replay da live (custa armazenamento no Mux) — decidir antes de ligar.
