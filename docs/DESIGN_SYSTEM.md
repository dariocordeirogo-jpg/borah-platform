# Design system LIVELANCE

Fundo branco predominante, verde metálico como cor principal, amarelo metálico como secundária.
Tokens em `src/app/globals.css` (`@theme`), usados como classes Tailwind (`bg-green`, `text-gold-ink`…).

| Token | Hex | Uso |
| --- | --- | --- |
| `green` | #168447 | Botões principais, ícones, links fortes |
| `green-deep` | #105B35 | Texto verde, preços, hover |
| `green-soft` | #E4F2EA | Fundos de ícones e cards |
| `gold` | #D6A52D | **Só fundo** (botão de lance, destaques) com texto `ink` |
| `gold-light` | #EBCB72 | Destaque sobre verde |
| `gold-ink` | #8A6412 | Texto dourado sobre branco |
| `ink` | #202820 | Texto principal |
| `muted` | #5B6B5E | Texto secundário |
| `surface` | #F5F7F4 | Fundos alternativos |
| `danger` | #B42318 | Erros, AO VIVO, cronômetro urgente |
| `green-night` | #0D3B24 | Rodapé e áreas institucionais (texto branco 12,6:1) |
| `live` | #E5484D | Ponto "ao vivo" (só decorativo, nunca texto) |

Utilitários metálicos: `metal-green`, `metal-gold`, `text-metal-green` — só em elementos de marca.

## Contraste (WCAG AA, medido)

| Combinação | Razão | Resultado |
| --- | --- | --- |
| verde #168447 sobre branco | 4,75:1 | Passa |
| verde profundo sobre branco | 8,17:1 | Passa |
| grafite sobre dourado | 6,70:1 | Passa |
| gold-ink sobre branco | 5,37:1 | Passa |
| dourado #D6A52D sobre branco | 2,26:1 | **Proibido para texto** |

## Tipografia

Sora (títulos, `font-display`) e Inter (texto).

## Logomarca

Símbolo: **play** de transmissão (branco) + **seta de lance subindo** (dourado) + **ponto "ao vivo"** (vermelho),
sobre quadrado verde metálico. Wordmark: LIVE em verde profundo, LANCE em dourado escuro (≥ 3:1, texto grande).

| Versão | Componente | Arquivo |
| --- | --- | --- |
| Horizontal | `<Logo />` | `public/brand/livelance-horizontal.svg` |
| Vertical | `<LogoStacked />` | `public/brand/livelance-vertical.svg` |
| Reduzida (símbolo) | `<LogoMark />` | `public/brand/livelance-simbolo.svg`, `src/app/icon.svg` (favicon) |
| Monocromática | `<Logo mono />`, `<LogoMark mono />` | `public/brand/livelance-simbolo-mono.svg`, `livelance-horizontal-mono-branco.svg` |
| App / PWA | — | `src/app/apple-icon.png`, `public/brand/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` |

Os SVGs de wordmark usam texto com fonte Sora; para impressão e gráfica, converter o texto em curvas.
Esta é a versão inicial da marca, feita em código: vale uma revisão por designer antes de materiais impressos.

## Componentes

`Button`/`ButtonLink` (variantes primary, gold, outline, ghost, light), `AuctionCard`, `UpcomingCard`, `ProductCard`,
`Countdown`, `Header` (Comprar · Ao vivo · Leilões sempre visíveis), `BottomNav` (Início, Market, Ao vivo, Leilões, Conta),
`Footer` (verde escuro), `ComingSoon`, formulários de login e recuperação de senha em `auth-forms.tsx`.
No celular as fileiras de leilão viram carrossel deslizante.
