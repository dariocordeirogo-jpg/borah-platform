# Migração de marca: BORAH → LIVELANCE

Data: 2026-11-06. Objetivo: trocar toda a identidade pública para LIVELANCE sem perder código, dados ou histórico.

## 1. O que mudou

| Área | Antes | Depois |
| --- | --- | --- |
| Nome | BORAH | LIVELANCE |
| Slogan | Assista. Compre. Venda. Ganhe. | **Tudo acontece ao vivo.** / Compre. Venda. Assista. Dê seu lance. |
| Símbolo | "B" com faísca | Play + seta de lance + ponto ao vivo (horizontal, vertical, reduzida, mono) |
| Módulos | LANCES, AO VIVO, MARKET, INDICA, NEGÓCIOS, PAY, VÍDEOS | MARKET, LIVE, LEILÕES, SELLER, PAY (+ "Indique e ganhe" sem marca de módulo) |
| Rota de leilões | `/lances` | `/leiloes` (antiga redireciona, 308) |
| Navegação | Lances em destaque | Comprar · Ao vivo · Leilões sempre visíveis, com ícone e cor próprios |
| Rodapé | Cinza claro | Claro, com texto azul-marinho (ver seção 5) |
| SEO | Título simples | Título, descrição, canonical, Open Graph, Twitter, robots, sitemap, manifest PWA |
| Pacote npm | `borah-platform` | `livelance` |

Novos: recuperação de senha (`/recuperar-senha`, `/nova-senha`), templates de e-mail em `supabase/templates/`,
redirecionamento `www.livelance.com.br` → `livelance.com.br`, `src/lib/site.ts` como fonte única da marca.

## 2. Banco de dados

Migração `20261106133738_marca_livelance` (não destrutiva): atualiza só a descrição das 5 feature flags e o nome
padrão de quem se cadastra sem nome. Nenhuma tabela, coluna, enum, usuário ou id foi apagado ou recriado.
O único usuário existente (de teste) teve só o e-mail trocado para `e2e@livelance.test`, mantendo id, perfil e papéis.

## 3. O que continua com o nome antigo, de propósito

| Item | Por quê |
| --- | --- |
| Repositório GitHub `borah-platform` | Renomear muda a URL do repositório; fazer pelo GitHub (Settings → Rename) quando quiser — o GitHub redireciona a URL antiga |
| Projeto Supabase `borah-platform` | Nome interno do painel, invisível ao público; o endereço da API não muda |
| Migrations de 2026-11-06 12:21 | Histórico já aplicado; editar quebraria a correspondência com o banco |
| Este relatório e o histórico do git | Registro da mudança |

## 4. Itens do pedido que ainda não existem no código

Painéis administrativos, painel do vendedor, páginas de produto, páginas de leilão, salas de live, notificações e
e-mails transacionais além de confirmação e senha ainda não foram construídos (fases 2 a 8). Eles nascem já com a marca
LIVELANCE e os nomes de módulo de `src/lib/site.ts`.

## 5. Atualização visual (paleta vermelho · azul-marinho · branco)

- Verde removido de toda a interface; tokens novos em `src/app/globals.css` (ver `docs/DESIGN_SYSTEM.md`).
- Dourado restrito aos botões de compra e lance (`btn-buy`), com teste automático que garante a regra.
- Logo redesenhada a partir da referência enviada: play 3D vermelho com martelo, órbita e ondas; ícone do app em 3D.
- Rodapé, topo da home e área do vendedor passaram a ser claros (sem grandes áreas escuras).
- Templates de e-mail e imagem de compartilhamento na nova paleta. Banco de dados não foi alterado nesta etapa.

## 6. Nova marca: LIVELANCE → Zexi (12/11/2026)

Decisões do dono do projeto: nome **Zexi**, domínio **zexi.com.br**, slogan mantido ("Tudo acontece ao vivo."),
destaque **coral #FF4D2D** sobre **grafite #0F1115** e branco, módulos **ZEXI MARKET, ZEXI LIVE, ZEXI LEILÕES,
ZEXI SELLER, ZEXI PAY**.

- Logo novo (símbolo "Z" geométrico + ponto AO VIVO; wordmark "zexi" com o pingo do i em coral), ícones do app,
  favicon, ícone Apple, manifesto e imagem de compartilhamento.
- Tokens de cor trocados em `src/app/globals.css` (nomes mantidos). Coral de ação #D9391B nos botões por contraste AA.
- Textos do site, SEO, e-mails, prompts da IA, documentos e testes trocados para Zexi.
- Banco (migration `20261112142831_marca_zexi`): descrições das flags, nome padrão de usuário ("Usuário Zexi") e
  prefixo padrão do código de indicação (`zexi`). Nenhum dado de usuário alterado.

Ficam com o nome antigo, de propósito:

| Item | Por quê |
| --- | --- |
| Migrations já aplicadas | Histórico; editar quebraria a correspondência com o banco |
| Tempero do hash de CPF (`livelance:cpf:`) | Mudar quebraria a regra de um CPF por conta para quem já se verificou |
| Rotina agendada `livelance-auction-jobs` (pg_cron) | Nome interno, invisível; está numa migration aplicada |
| Contas e loja de teste (`@livelance.test`, "Loja E2E LIVELANCE") | Dados do banco de desenvolvimento usados pelos testes; somem na limpeza antes do lançamento |
| Projeto "live" na Vercel e repositório `borah-platform` | Nomes internos; renomear pelo painel quando quiser |

Pendências do dono: registrar **zexi.com.br** e verificar a marca **Zexi no INPI** (classes de comércio eletrônico e
leilões) antes de investir em divulgação.
