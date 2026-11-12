# Design system Zexi

**Grafite** e **branco** são a base (alto contraste, dark e light). **Coral** é o pulso da marca: ação, AO VIVO e lance.
Os nomes dos tokens (`brand`, `navy`) foram mantidos da marca anterior: `brand` = coral de ação, `navy` = grafite.
**Dourado metálico** é exclusivo dos botões de compra e de lance.

Tokens em `src/app/globals.css` (`@theme`), usados como classes Tailwind (`bg-brand`, `text-navy`…).

## Cores

| Token | Hex | Uso |
| --- | --- | --- |
| `brand` | #FF4D2D | Laranja Zexi: botão principal, links e navegação ativos, ícones, ponto AO VIVO |
| `brand-vivid` | #FF4D2D | Mesmo laranja (nome usado no logo, pingo do i, selos e fios) |
| `brand-dark` | #E23A1C | Hover/active do laranja |
| `brand-soft` | #FDECEC | Fundo de ícones e hover leve |
| `navy` | #0F1115 | Grafite: títulos, preços, maior lance, logo, fundos escuros |
| `navy-2` | #1F232B | Grafite claro: textos de apoio, rótulos, foco |
| `navy-soft` | #EEF0F3 | Fundos informativos (ex.: aviso de verificação) |
| `ink` | #1A2230 | Texto corrido |
| `muted` | #5A6878 | Texto secundário |
| `line` | #E3E6EB | Bordas e divisórias |
| `surface` / `surface-2` | #F5F6F8 / #EDEFF3 | Fundos alternativos, rodapé, área de foto |
| `danger` | #B42318 | Erros e cronômetro nos últimos minutos (funcional) |
| `success` / `success-soft` | #1E7A46 / #E8F5EE | **Só** mensagens de status de sucesso (funcional) |
| `buy` / `buy-dark` | #D6A638 / #B88720 | **Só** via `btn-buy` ou `<Button variant="buy">` |

## Regra do dourado

Usar `btn-buy` (ou `variant="buy"`) apenas em: **Comprar agora**, **Finalizar compra**, **Adicionar ao carrinho**
(quando for a ação principal), **Dar lance**, **Confirmar lance**, **Fazer oferta**. Texto em grafite.
Nunca em logo, cabeçalho, rodapé, menu, títulos, ícones, bordas, fundos, indicadores, gráficos ou ações administrativas.
O teste `tests/e2e/palette.spec.ts` falha se aparecer dourado fora de um botão de compra/lance, ou verde fora de status.

## Contraste (WCAG AA, medido)

| Combinação | Razão |
| --- | --- |
| branco sobre laranja (botões, texto em negrito) | 3,3:1 — escolha da marca; abaixo do AA para texto pequeno |
| grafite sobre branco | 18,9:1 |
| grafite sobre dourado | ≥ 7:1 |
| cinza `muted` sobre branco | 5,70:1 |
| coral de ação sobre `brand-soft` | 4,54:1 |

## Logomarca

Os arquivos do logo foram **vetorizados da arte original** enviada pelo dono da marca (não redesenhados):
`zexi-logo.svg` / `zexi-logo-branco.svg` (horizontal), `zexi-simbolo*.svg`, `zexi-palavra.svg`, ícones de app.

Símbolo: **"Z" geométrico** com cortes diagonais; o braço central sugere o "X" (o encontro de quem compra e quem
vende, o ponto exato do lance) e o **ponto coral** no alto à direita é o indicador AO VIVO/REC. Wordmark **zexi** em
minúsculas, com o pingo do i em laranja. Arquivos em `public/brand/`: `zexi-simbolo.svg` (fundo
claro), `zexi-simbolo-branco.svg` (fundo escuro), `zexi-simbolo-mono.svg` (uma cor), `zexi-icone-app.svg` e PNGs.
Sem dourado na marca. Nas lives, o símbolo translúcido pode ir no canto como marca d'água.

| Versão | Componente | Arquivo |
| --- | --- | --- |
| Símbolo colorido | `<LogoMark />` | `public/brand/zexi-simbolo.svg` |
| Horizontal | `<Logo />` | `public/brand/zexi-simbolo.svg` |
| Vertical com slogan | `<LogoStacked />` | `public/brand/zexi-simbolo.svg` |
| Monocromática | `<LogoMark mono />`, `<Logo mono />` | `public/brand/zexi-simbolo-mono.svg` |
| Ícone do app 3D | — | `public/brand/zexi-icone-app.svg`, `zexi-icone-app-1024.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `src/app/icon.svg`, `src/app/apple-icon.png` |

Os SVGs com texto usam a fonte Sora; para gráfica, converter em curvas. A logo foi redesenhada em vetor a partir
da referência enviada; vale a revisão de um designer antes de materiais impressos.

## Tipografia

Sora (títulos e wordmark, `font-display`) e Inter (texto).

## Componentes

`Button`/`ButtonLink` (primary coral, secondary grafite, outline, ghost, **buy dourado**), `AuctionCard`
(maior lance em destaque grafite, botão Dar lance dourado), `UpcomingCard`, `ProductCard` (Comprar agora dourado),
`Countdown`, `Header`, `BottomNav` (item ativo em coral), `Footer` (claro), `ComingSoon`, formulários em `auth-forms.tsx`.

## Imagens da home

`public/images/home/` — banner principal (`hero.webp`) e fotos das modalidades (`compre`, `live`, `leilao`).
Geradas por IA (Higgsfield, modelo Z Image) em 12/11/2026, sem marcas de terceiros, convertidas para WebP.
São ilustrativas (o banner mostra "Imagem ilustrativa"); trocar por fotos próprias da Zexi quando houver.
Texto sobre foto: degradê grafite à esquerda (desktop) ou foto em cima e texto embaixo (celular);
"ao vivo." usa `text-brand-bright` (#FF6A4F), coral claro para contraste sobre o grafite.

## Home no estilo vitrine

- `src/components/home/hero-carousel.tsx`: carrossel com 4 banners (Tudo acontece ao vivo, Lives, Leilões, Cupons),
  fundo de cor forte da marca, foto à direita (em cima no celular), setas, bolinhas e troca a cada 6 s
  (pausa com mouse/foco e com "reduzir movimento"). Slides fora da tela ficam `inert`/`aria-hidden`.
  O `h1` da página é fixo (`sr-only`); os títulos dos slides são `h2`.
- Faixa de 6 atalhos sobre o fim do carrossel (cartão branco, ícone em círculo, texto curto, link em coral).
- Textos não prometem o que ainda não existe (sem "frete grátis" nem "parcelamento").
