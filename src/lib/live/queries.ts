import "server-only";
import { connection } from "next/server";
import { productImageUrl } from "@/lib/market/images";
import { createClient } from "@/lib/supabase/server";

async function db() {
  await connection();
  return createClient();
}

const LIVE_CARD = "id, title, status, scheduled_at, started_at, stores(name, slug)" as const;

/** /ao-vivo: no ar agora e próximas (até 7 dias). */
export async function listLives() {
  const supabase = await db();
  const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: live }, { data: upcoming }] = await Promise.all([
    supabase.from("lives").select(LIVE_CARD).eq("status", "live").order("started_at", { ascending: false }).limit(24),
    supabase.from("lives").select(LIVE_CARD).eq("status", "scheduled").lte("scheduled_at", until).order("scheduled_at").limit(24),
  ]);
  return { live: live ?? [], upcoming: upcoming ?? [] };
}

export type LiveProduct = { id: string; title: string; priceCents: number; stock: number; imageUrl: string | null };

/** Página da live: dados, produtos, leilão relâmpago ativo e últimas mensagens. */
export async function getLive(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await db();
  const { data: live } = await supabase
    .from("lives")
    .select("id, store_id, title, description, status, scheduled_at, started_at, ended_at, playback_url, pinned_product_id, stores(name, slug)")
    .eq("id", id)
    .maybeSingle();
  if (!live) return null;
  const [{ data: items }, { data: auction }, { data: messages }] = await Promise.all([
    supabase
      .from("live_products")
      .select("position, products(id, title, price_cents, stock, status, product_images(path, position))")
      .eq("live_id", id)
      .order("position"),
    supabase
      .from("auctions")
      .select("id, title, current_price_cents, starting_price_cents, bids_count, ends_at, status, product_id")
      .eq("live_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("live_messages")
      .select("id, alias, body, hidden, created_at")
      .eq("live_id", id)
      .order("id", { ascending: false })
      .limit(50),
  ]);
  const products: LiveProduct[] = (items ?? [])
    .map((i) => i.products)
    .filter((p): p is NonNullable<typeof p> => Boolean(p) && p!.status === "active")
    .map((p) => {
      const first = [...(p.product_images ?? [])].sort((a, b) => a.position - b.position)[0];
      return { id: p.id, title: p.title, priceCents: p.price_cents, stock: p.stock, imageUrl: first ? productImageUrl(first.path) : null };
    });
  return {
    live,
    products,
    pinned: products.find((p) => p.id === live.pinned_product_id) ?? null,
    auction: auction ?? null,
    messages: (messages ?? []).reverse(),
  };
}

export async function getSellerLives(storeId: string) {
  const supabase = await db();
  const { data } = await supabase
    .from("lives")
    .select("id, title, status, scheduled_at, started_at, ended_at")
    .eq("store_id", storeId)
    .order("scheduled_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function getLiveProductsForSeller(storeId: string) {
  const supabase = await db();
  const { data } = await supabase
    .from("products")
    .select("id, title, price_cents, stock")
    .eq("store_id", storeId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(100);
  return data ?? [];
}
