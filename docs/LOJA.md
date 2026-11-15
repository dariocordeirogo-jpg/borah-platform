# Página da loja personalizada

Cada loja tem a própria página (`/loja/<endereço>`) e personaliza em **Painel do vendedor → Loja** (`/seller/loja`):

- **Logo** (quadrado) e **capa** (1600 × 400), em JPG, PNG ou WebP de até 5 MB. O arquivo é conferido pela assinatura real.
- **Cor da página:** laranja, grafite, azul, verde, roxo, vermelho, rosa ou turquesa. Sem capa, a página usa um degradê nessa cor.
- **Frase de apresentação** (até 120 caracteres).
- **Banners** (até 5), em carrossel no topo, com título opcional e link opcional para um produto da própria loja.
- **Produtos em destaque** (até 12).

A página pública tem estas seções:
- capa, logo, nome, frase e reputação;
- abas Início / Destaques / Ofertas / Todos os produtos / Sobre a loja;
- carrossel de banners;
- destaques;
- ofertas da loja (produtos com preço "de");
- todos os produtos, com paginação.

Regras:
- Contato é proibido. O texto da frase, do nome, da descrição e dos títulos dos banners passa pelo filtro que oculta
  telefone, e-mail, links e redes sociais. Imagens com contato podem ser removidas pela moderação (a loja é avisada na tela).
- Imagens ficam no bucket público `store-media`. Cada loja só envia e apaga arquivos da própria pasta (`<id da loja>/...`).
- O banco confere os limites (5 banners, 12 destaques) e que o produto do banner ou do destaque é da própria loja.

Banco: `20261115175107_loja_personalizada.sql` e `20261115180134_loja_destaques_chave.sql`. Teste: `supabase/tests/loja.sql`.
O destaque usa um `id` próprio como chave. Com a chave (loja, produto), a API passava a ver a tabela como ligação entre
produtos e lojas, e a consulta "produto → loja" ficava ambígua.
