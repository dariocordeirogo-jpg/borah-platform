# Design system BORAH

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

Sora (títulos, `font-display`) e Inter (texto). Logo provisório: símbolo "B" com faísca dourada em `src/components/logo.tsx` — o logo definitivo é entrega separada.

## Componentes

`Button`/`ButtonLink` (variantes primary, gold, outline, ghost, light), `AuctionCard`, `UpcomingCard`, `ProductCard`,
`Countdown`, `Header`, `BottomNav` (celular), `Footer`, `ComingSoon`, formulários de login em `auth-forms.tsx`.
No celular as fileiras de leilão viram carrossel deslizante.
