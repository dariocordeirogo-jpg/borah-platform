# Conector TikTok → Zexi

Lê o chat das lives do TikTok das lojas e repassa cada comentário, assinado, para o banco da Zexi.
O banco decide tudo (vínculo do @, lance, carrinho) com as mesmas regras do site: ver
`supabase/migrations/20261115000155_ponte_social.sql` e `docs/LIVE.md` → "Ponte com TikTok e Instagram".

## Rodar (Railway ou qualquer servidor Node 20+)

Variáveis de ambiente:

| Variável | O que é |
| --- | --- |
| `SUPABASE_URL` | `https://elygbieuroidqxkifgou.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | chave publishable (pública) do Supabase |
| `SOCIAL_BRIDGE_SECRET` | segredo de 32+ caracteres; o mesmo salvo no Vault do Supabase como `social_bridge_secret` |
| `EULER_API_KEY` | opcional: chave da Euler Stream (assinatura da conexão com o TikTok, sem ela há limite de uso) |

```bash
cd workers/social-bridge && npm install && npm start
```

Nada de segredo vai para o GitHub nem para o site: o conector só usa a chave pública do Supabase e o segredo
da ponte, que o banco confere em cada chamada.

## Limites

- `tiktok-live-connector` não é oficial do TikTok (lê o chat público da live). Pode parar de funcionar se o
  TikTok mudar algo; o site continua normal, só a ponte para.
- Instagram não passa por aqui: os comentários de live do Instagram chegam pelo webhook oficial da Meta
  (precisa de um app aprovado na Meta). O banco já aceita `platform = 'instagram'`.
