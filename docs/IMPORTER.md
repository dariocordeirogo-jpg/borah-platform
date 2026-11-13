# Importar anúncio de outro site

Em **Seller → Produtos → Importar de outro site** (`/seller/produtos/importar`) a loja cola o link de um anúncio dela em
outra loja virtual. A Zexi lê a página, mostra título, preço, preço anterior, condição, descrição e fotos para revisão e,
com a confirmação de que o anúncio é da loja, cria o produto como **rascunho** (não aparece na vitrine até a loja ativar).

## O que funciona

- Lojas com dados de produto no padrão schema.org (JSON-LD): Shopify, Nuvemshop, VTEX, Wix, WooCommerce, Tray, Loja
  Integrada, Magento e a maioria das plataformas. Reserva: metatags OpenGraph de produto.
- Só preços em reais (BRL). Até 8 fotos (JPG, PNG ou WebP, até 5 MB cada), copiadas para o armazenamento da Zexi.
- O link de origem fica em `products.imported_from` (migration `20261112225000_produtos_importados`).

## Mercado Livre e outros marketplaces fechados

A API pública do Mercado Livre exige login (OAuth) desde 2025, e as páginas de marketplace (ML, Shopee, Amazon)
costumam bloquear leitura automática. O caminho oficial é a loja **conectar a própria conta do Mercado Livre** e
escolher os anúncios dela. Para isso é preciso criar um aplicativo em developers.mercadolivre.com.br (client id,
client secret e URL de retorno `https://www.zexi.com.br/seller/integracoes/mercado-livre/retorno`).

## Segurança (SSRF)

`src/lib/importer/safe-fetch.ts` e `src/lib/importer/ip.ts`:

- só `http`/`https`, portas padrão, sem usuário/senha na URL;
- todos os IPs do domínio precisam ser públicos (bloqueia rede interna, loopback, link-local/metadata de nuvem
  169.254.169.254, IPv6 privado, IPv4 embutido em IPv6, NAT64, 6to4);
- cada redirecionamento é conferido de novo (máx. 4); tempo de 10 s (15 s por foto); página até 3 MB;
- fotos conferidas pela assinatura do arquivo, não pelo tipo informado pelo site.

`ZEXI_IMPORT_ALLOW_LOOPBACK=1` existe **só para os testes e2e** (servidor de exemplo em 127.0.0.1, definido em
`playwright.config.ts`). Nunca definir na Vercel.

## Testes

- `tests/unit/importer.test.ts`: leitura de JSON-LD (@graph, ProductGroup, AggregateOffer, preço riscado, moeda), OpenGraph,
  limites e lista de IPs bloqueados.
- `tests/e2e/importer.spec.ts`: recusa metadata de nuvem, redirecionamento para a rede interna e página sem produto;
  importa de uma loja de exemplo, exige a confirmação de autoria e cria rascunho com as fotos.
