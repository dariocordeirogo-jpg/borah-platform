import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { site } from "@/lib/site";
import { createAnonClient } from "@/lib/supabase/anon";

/** Páginas públicas fixas + produtos, lojas e leilões ativos (lojas de teste ficam de fora). */
const routes = ["", "/market", "/ao-vivo", "/leiloes", "/videos", "/vender", "/indique", "/leiloes/regras", "/termos", "/privacidade"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const fixed: MetadataRoute.Sitemap = routes.map((path) => ({
    url: `${site.url}${path}`,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/market" ? 0.9 : 0.6,
  }));
  if (!site.production) return fixed;

  const db = createAnonClient();
  const [stores, products, auctions] = await Promise.all([
    db.from("stores").select("id, slug, updated_at").eq("is_active", true).eq("is_test", false).limit(5000),
    db.from("products").select("id, updated_at, store_id, stores!inner(is_test)").eq("status", "active").eq("stores.is_test", false).order("updated_at", { ascending: false }).limit(20000),
    db.from("auctions").select("id, updated_at, stores!inner(is_test)").eq("status", "active").eq("stores.is_test", false).limit(5000),
  ]);
  return [
    ...fixed,
    ...(stores.data ?? []).map((s) => ({ url: `${site.url}/loja/${s.slug}`, lastModified: s.updated_at, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...(products.data ?? []).map((p) => ({ url: `${site.url}/produto/${p.id}`, lastModified: p.updated_at, changeFrequency: "daily" as const, priority: 0.8 })),
    ...(auctions.data ?? []).map((a) => ({ url: `${site.url}/leilao/${a.id}`, lastModified: a.updated_at, changeFrequency: "hourly" as const, priority: 0.7 })),
  ];
}
