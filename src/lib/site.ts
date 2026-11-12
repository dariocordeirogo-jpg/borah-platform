/**
 * Identidade pública da plataforma. Fonte única para nome, slogan, SEO e módulos.
 * A URL do site vem de NEXT_PUBLIC_SITE_URL. O endereço oficial é https://www.zexi.com.br
 * (na Vercel, zexi.com.br redireciona para o www).
 */
export const site = {
  name: "Zexi",
  slogan: "Tudo acontece ao vivo.",
  tagline: "Compre. Venda. Assista. Dê seu lance.",
  title: "Zexi | Marketplace, Vendas ao Vivo e Leilões Online",
  description:
    "Na Zexi você compra, vende, acompanha transmissões ao vivo e participa de leilões digitais em uma única plataforma.",
  productionDomain: "zexi.com.br",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  /** Só é produção quando o site responde no domínio oficial. */
  production: (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "") === "https://www.zexi.com.br",
} as const;

/** Módulos da plataforma (nomes oficiais). */
export const modules = {
  market: { name: "ZEXI MARKET", short: "Market", href: "/market" },
  live: { name: "ZEXI LIVE", short: "Ao vivo", href: "/ao-vivo" },
  auctions: { name: "ZEXI LEILÕES", short: "Leilões", href: "/leiloes" },
  seller: { name: "ZEXI SELLER", short: "Vender", href: "/vender" },
  pay: { name: "ZEXI PAY", short: "Pagamentos", href: null },
} as const;
