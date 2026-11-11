# LIVELANCE LIVE — transmissão (Mux)

O vídeo das lives é transmitido pelo [Mux](https://www.mux.com). A loja transmite do OBS (computador) ou de um app
de celular (RTMP, ex.: Larix Broadcaster); quem assiste recebe o vídeo HLS no player da LIVELANCE (hls.js).

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

## Configuração

1. Mux → Settings → Access Tokens → gerar token com permissão **Mux Video (Read + Write)** no ambiente certo
   (um ambiente de desenvolvimento para testes e o de produção para o lançamento).
2. Vercel: `MUX_TOKEN_ID` e `MUX_TOKEN_SECRET` (só no servidor).
3. `GET /api/health` mostra `integrations.live: true`.

## Segurança

- Tabela `private.live_streams` sem acesso pela API; leitura e escrita só por `attach_live_stream`,
  `live_stream_ref` (dono da loja ou moderação) e `mark_live_stream_disabled`.
- IDs do Mux validados (`^[A-Za-z0-9]{10,100}$`) antes de virar URL.
- Teste: `supabase/tests/live_mux.sql` e `tests/unit/mux.test.ts`.

## Pendências

- Suspensão de loja cancela as lives no banco, mas não desliga as transmissões no Mux (só o encerramento de uma
  live desliga). Baixo risco: a live cancelada some do site; tratar com webhook do Mux se necessário.
- Gravação/replay da live (custa armazenamento no Mux) — decidir antes de ligar.
