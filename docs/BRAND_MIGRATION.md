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
| Rodapé | Cinza claro | Verde escuro institucional |
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
