import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Páginas públicas fixas. Produtos, lojas, lives e lotes entram aqui quando existirem no banco. */
const routes = ["", "/market", "/ao-vivo", "/leiloes", "/vender", "/indique", "/termos", "/privacidade"];
// Produtos e lojas entram quando o domínio de produção estiver no ar (sitemap dinâmico com consulta ao banco).

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((path) => ({
    url: `${site.url}${path}`,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
