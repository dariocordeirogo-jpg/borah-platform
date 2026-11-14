import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { siteLocked } from "@/lib/site-lock";

export default function robots(): MetadataRoute.Robots {
  // Fora de produção (preview/dev) ou com o site fechado para construção, não indexar.
  const isProduction = site.production && !siteLocked();
  return {
    rules: isProduction
      ? [{ userAgent: "*", allow: "/", disallow: ["/conta", "/auth/", "/carrinho", "/checkout", "/seller", "/admin", "/api/", "/entrar", "/cadastro", "/em-construcao", "/r/"] }]
      : [{ userAgent: "*", disallow: "/" }],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
