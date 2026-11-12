# Design system LIVELANCE

**Vermelho** é a marca. **Azul-marinho** dá confiança (títulos, valores, navegação). **Branco** é o fundo.
**Dourado metálico** é exclusivo dos botões de compra e de lance.

Tokens em `src/app/globals.css` (`@theme`), usados como classes Tailwind (`bg-brand`, `text-navy`…).

## Cores

| Token | Hex | Uso |
| --- | --- | --- |
| `brand` | #D71920 | Identidade, ícones, links e navegação ativos, botão principal, selo AO VIVO |
| `brand-dark` | #A90F18 | Hover/active do vermelho |
| `brand-soft` | #FDECEC | Fundo de ícones e hover leve |
| `navy` | #10243A | Títulos, preços, maior lance, textos de destaque |
| `navy-2` | #183B5B | Textos de apoio, rótulos, foco |
| `navy-soft` | #E9EEF4 | Fundos informativos (ex.: aviso de verificação) |
| `ink` | #1A2230 | Texto corrido |
| `muted` | #5A6878 | Texto secundário |
| `line` | #E3E6EB | Bordas e divisórias |
| `surface` / `surface-2` | #F5F6F8 / #EDEFF3 | Fundos alternativos, rodapé, área de foto |
| `danger` | #B42318 | Erros e cronômetro nos últimos minutos (funcional) |
| `success` / `success-soft` | #1E7A46 / #E8F5EE | **Só** mensagens de status de sucesso (funcional) |
| `buy` / `buy-dark` | #D6A638 / #B88720 | **Só** via `btn-buy` ou `<Button variant="buy">` |

## Regra do dourado

Usar `btn-buy` (ou `variant="buy"`) apenas em: **Comprar agora**, **Finalizar compra**, **Adicionar ao carrinho**
(quando for a ação principal), **Dar lance**, **Confirmar lance**, **Fazer oferta**. Texto em azul-marinho (7,0:1).
Nunca em logo, cabeçalho, rodapé, menu, títulos, ícones, bordas, fundos, indicadores, gráficos ou ações administrativas.
O teste `tests/e2e/palette.spec.ts` falha se aparecer dourado fora de um botão de compra/lance, ou verde fora de status.

## Contraste (WCAG AA, medido)

| Combinação | Razão |
| --- | --- |
| vermelho sobre branco / branco sobre vermelho | 5,19:1 |
| azul-marinho sobre branco | 15,72:1 |
| azul-marinho sobre dourado | 7,02:1 |
| cinza `muted` sobre branco | 5,70:1 |
| vermelho sobre `brand-soft` | 4,54:1 |

## Logomarca

Símbolo: **play 3D vermelho com martelo de leilão**, órbita e ondas de transmissão. Wordmark em itálico:
LIVE em vermelho, LANCE em azul-marinho. Sem dourado.

| Versão | Componente | Arquivo |
| --- | --- | --- |
| Símbolo colorido | `<LogoMark />` | `public/brand/livelance-simbolo.svg` |
| Horizontal | `<Logo />` | `public/brand/livelance-horizontal.svg` |
| Vertical com slogan | `<LogoStacked />` | `public/brand/livelance-vertical.svg` |
| Monocromática | `<LogoMark mono />`, `<Logo mono />` | `public/brand/livelance-simbolo-mono.svg` |
| Ícone do app 3D | — | `public/brand/livelance-icone-app.svg`, `livelance-icone-app-1024.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `src/app/icon.svg`, `src/app/apple-icon.png` |

Os SVGs com texto usam a fonte Sora; para gráfica, converter em curvas. A logo foi redesenhada em vetor a partir
da referência enviada; vale a revisão de um designer antes de materiais impressos.

## Tipografia

Sora (títulos e wordmark, `font-display`) e Inter (texto).

## Componentes

`Button`/`ButtonLink` (primary vermelho, secondary azul-marinho, outline, ghost, **buy dourado**), `AuctionCard`
(maior lance em destaque azul-marinho, botão Dar lance dourado), `UpcomingCard`, `ProductCard` (Comprar agora dourado),
`Countdown`, `Header`, `BottomNav` (item ativo em vermelho), `Footer` (claro), `ComingSoon`, formulários em `auth-forms.tsx`.

## Imagens da home

`public/images/home/` — banner principal (`hero.webp`) e fotos das modalidades (`compre`, `live`, `leilao`).
Geradas por IA (Higgsfield, modelo Z Image) em 12/11/2026, sem marcas de terceiros, convertidas para WebP.
São ilustrativas (o banner mostra "Imagem ilustrativa"); trocar por fotos próprias da LIVELANCE quando houver.
Texto sobre foto: degradê azul-marinho à esquerda (desktop) ou foto em cima e texto embaixo (celular);
"ao vivo." usa `text-brand-bright` (#FF5A61), versão clara do vermelho para contraste sobre o azul-marinho.
