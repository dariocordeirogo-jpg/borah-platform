# Importar anúncio de outro site

Em **Seller → Produtos → Importar de outro site** (`/seller/produtos/importar`) a loja cola o link de um anúncio dela em
outra loja virtual. A Zexi lê a página, mostra título, preço, preço anterior, condição, descrição e fotos para revisão e,
com a confirmação de que o anúncio é da loja, cria o produto como **rascunho** (não aparece na vitrine até a loja ativar).

## O que funciona

- Lojas com dados de produto no padrão schema.org (JSON-LD): Shopify, Nuvemshop, VTEX, Wix, WooCommerce, Tray, Loja
  Integrada, Magento e a maioria das plataformas. Reserva: metatags OpenGraph de produto.
- Só preços em reais (BRL). Até 8 fotos (JPG, PNG ou WebP, até 5 MB cada), copiadas para o armazenamento da Zexi.
- O link de origem fica em `products.imported_from` (migration `20261112225000_produtos_importados`).

## Importar em massa (`/seller/produtos/importar-em-massa`)

Para trazer muitos anúncios de uma vez. Tudo entra como **rascunho**, com uma categoria escolhida para o lote
(dá para trocar depois em cada produto) e a confirmação de que os anúncios são da loja.

- **Planilha** (.xlsx ou .csv) exportada pela outra plataforma: Mercado Livre (Modificar em massa → Modificar em
  Excel), Shopee (Ferramentas em massa → Atualização em massa), Shopify (Produtos → Exportar), Nuvemshop, Bling,
  Tray e outras. O arquivo é lido **no navegador** (`src/lib/importer/sheet.ts`, sem enviar o arquivo):
  - acha a linha de cabeçalho entre as 15 primeiras (planilhas de marketplace têm instruções acima);
  - sugere a coluna de cada campo pelo nome (com/sem acento, português e inglês) e o vendedor corrige o que
    precisar; fotos podem vir de várias colunas ou separadas por vírgula;
  - linhas com o mesmo "grupo" (Shopify: `Handle`) viram um anúncio só, juntando as fotos;
  - até 500 anúncios por vez e 5 fotos por anúncio. `.xls` antigo: salvar como `.xlsx` ou `.csv`.
- **Vários links** (até 100): mesma leitura do "importar um link", para lojas próprias (Shopify, Nuvemshop, VTEX,
  WooCommerce…). Mercado Livre e Shopee bloqueiam a leitura de páginas: para eles, use a planilha.

O servidor (`src/lib/importer/bulk-actions.ts`) recebe em lotes pequenos (5 linhas ou 3 links por chamada, o
navegador mostra o progresso), confere tudo de novo (preço em reais, estoque, peso, `productSchema`), não cria
de novo um anúncio cujo link de origem já foi importado pela loja e copia as fotos com a mesma proteção do
importador de um link (`src/lib/importer/save.ts`). Marca e SKU vão para o fim da descrição.

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
- `tests/unit/import-sheet.test.ts`: CSV (vírgula, ponto e vírgula, aspas, BOM), XLSX, cabeçalho abaixo de instruções,
  colunas do Mercado Livre/Shopee/Shopify, junção por Handle, fotos e limites.
- `tests/e2e/bulk-import.spec.ts`: planilha do Shopify (variações e fotos), planilha de marketplace (sem duplicar) e vários links.
- `tests/e2e/importer.spec.ts`: recusa metadata de nuvem, redirecionamento para a rede interna e página sem produto;
  importa de uma loja de exemplo, exige a confirmação de autoria e cria rascunho com as fotos.
