import { describe, expect, it } from "vitest";
import { isBlockedIp } from "@/lib/importer/ip";
import { htmlToText, parseListing, priceToCents } from "@/lib/importer/parse";

const page = (head: string, body = "") => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
const ld = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;

describe("leitura do anúncio (JSON-LD schema.org)", () => {
  it("produto simples (Shopify/Nuvemshop): título, preço, fotos, condição, marca", () => {
    const html = page(
      ld({
        "@context": "https://schema.org",
        "@type": "Product",
        name: "Tênis Corrida Leve &amp; Confortável",
        description: "<p>Cabedal em <b>mesh</b>.</p><ul><li>Peso 220 g</li></ul>",
        image: ["/fotos/1.jpg", "https://cdn.loja.com/2.jpg"],
        brand: { "@type": "Brand", name: "Marca X" },
        sku: "TN-01",
        offers: { "@type": "Offer", price: "299.90", priceCurrency: "BRL", itemCondition: "https://schema.org/NewCondition" },
      }) + '<meta property="og:site_name" content="Loja Exemplo">',
    );
    const r = parseListing(html, "https://loja.com.br/produtos/tenis?variant=1")!;
    expect(r).toMatchObject({
      title: "Tênis Corrida Leve & Confortável",
      priceCents: 29990,
      condition: "new",
      brand: "Marca X",
      sku: "TN-01",
      sourceName: "Loja Exemplo",
    });
    expect(r.images).toEqual(["https://loja.com.br/fotos/1.jpg", "https://cdn.loja.com/2.jpg"]);
    expect(r.description).toBe("Cabedal em mesh .\n• Peso 220 g");
  });

  it("@graph (WooCommerce/Yoast), AggregateOffer com menor preço e usado", () => {
    const html = page(
      ld({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebPage", name: "Página" },
          {
            "@type": ["Product"],
            name: "Furadeira 750 W",
            itemCondition: "UsedCondition",
            image: { "@type": "ImageObject", url: "https://img.loja.com/f.webp" },
            offers: { "@type": "AggregateOffer", lowPrice: 189.9, highPrice: 220, priceCurrency: "BRL" },
          },
        ],
      }),
    );
    const r = parseListing(html, "https://loja.com/p/furadeira")!;
    expect(r).toMatchObject({ title: "Furadeira 750 W", priceCents: 18990, condition: "used" });
    expect(r.images).toEqual(["https://img.loja.com/f.webp"]);
  });

  it("ProductGroup com variações e preço de tabela riscado", () => {
    const html = page(
      ld({
        "@type": "ProductGroup",
        name: "Camiseta Dry",
        hasVariant: [
          {
            "@type": "Product",
            offers: {
              price: "79,90",
              priceCurrency: "BRL",
              priceSpecification: [{ "@type": "UnitPriceSpecification", priceType: "https://schema.org/ListPrice", price: 99.9 }],
            },
          },
        ],
      }),
    );
    expect(parseListing(html, "https://x.com/c")).toMatchObject({ priceCents: 7990, compareAtCents: 9990 });
  });

  it("ignora oferta em outra moeda e JSON-LD com vírgula sobrando", () => {
    const html = page(
      `<script type="application/ld+json">{"@type":"Product","name":"Relógio","offers":[{"price":"10","priceCurrency":"USD"},{"price":"150.00","priceCurrency":"BRL"},],}</script>`,
    );
    expect(parseListing(html, "https://x.com/r")).toMatchObject({ title: "Relógio", priceCents: 15000 });
  });

  it("sem JSON-LD: usa OpenGraph de produto", () => {
    const html = page(
      '<meta property="og:type" content="product"><meta property="og:title" content="Mochila 15,6&quot;">' +
        '<meta property="product:price:amount" content="129.90"><meta property="product:price:currency" content="BRL">' +
        '<meta property="og:image" content="/m1.jpg"><meta property="og:image" content="/m2.jpg"><meta property="og:description" content="Resistente à água">',
    );
    const r = parseListing(html, "https://loja.com/mochila")!;
    expect(r).toMatchObject({ title: 'Mochila 15,6"', priceCents: 12990, description: "Resistente à água" });
    expect(r.images).toEqual(["https://loja.com/m1.jpg", "https://loja.com/m2.jpg"]);
  });

  it("página que não é de produto devolve null", () => {
    expect(parseListing(page("<title>Blog</title>", "<p>texto</p>"), "https://x.com/blog")).toBeNull();
  });

  it("limita fotos a 8 e ignora links que não são http(s)", () => {
    const html = page(
      ld({ "@type": "Product", name: "X", image: ["javascript:alert(1)", ...Array.from({ length: 12 }, (_, i) => `/i${i}.jpg`)] }),
    );
    const r = parseListing(html, "https://x.com/p")!;
    expect(r.images).toHaveLength(8);
    expect(r.images.every((u) => u.startsWith("https://x.com/"))).toBe(true);
  });
});

describe("preço e texto", () => {
  it.each([
    ["1299.90", 129990],
    [1299.9, 129990],
    ["1.299,90", 129990],
    ["R$ 59,90", 5990],
    ["0", null],
    ["", null],
  ])("%s → %s", (v, cents) => expect(priceToCents(v)).toBe(cents));

  it("descrição sem scripts nem estilos", () => {
    expect(htmlToText('<style>a{}</style><script>alert(1)</script><p>Olá&nbsp;mundo</p>')).toBe("Olá mundo");
  });
});

describe("bloqueio de endereços internos (SSRF)", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.9",
    "192.168.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:a9fe:a9fe",
    "64:ff9b::a00:1",
    "2002:c0a8:0001::1",
    "999.1.1.1",
  ])("bloqueia %s", (ip) => expect(isBlockedIp(ip)).toBe(true));

  it.each(["8.8.8.8", "200.147.67.142", "2606:4700:4700::1111", "2804:14c::1"])("libera %s", (ip) =>
    expect(isBlockedIp(ip)).toBe(false),
  );
});
