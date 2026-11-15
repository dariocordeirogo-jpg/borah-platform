import "server-only";
import { connection } from "next/server";
import { CARD_SELECT, toCard, type CardRow } from "@/lib/market/queries";
import { storeMediaUrl } from "@/lib/stores/format";
import { createClient } from "@/lib/supabase/server";

export type StoreBanner = { id: number; imageUrl: string; title: string | null; productId: string | null };

/** Banners e destaques da página da loja (só produtos à venda aparecem nos destaques). */
export async function getStoreShowcase(storeId: string) {
  await connection();
  const supabase = await createClient();
  const [{ data: banners }, { data: featured }] = await Promise.all([
    supabase.from("store_banners").select("id, image_path, title, product_id").eq("store_id", storeId).order("position").order("id"),
    supabase
      .from("store_featured")
      .select(`position, products!inner(${CARD_SELECT}, status)`)
      .eq("store_id", storeId)
      .eq("products.status", "active")
      .order("position"),
  ]);
  return {
    banners: (banners ?? []).map((b): StoreBanner => ({ id: b.id, imageUrl: storeMediaUrl(b.image_path), title: b.title, productId: b.product_id })),
    featured: ((featured ?? []) as unknown as { products: CardRow }[]).map((f) => toCard(f.products)),
  };
}

/** Para o painel: banners com caminho e ids dos destaques. */
export async function getMyStoreMedia(storeId: string) {
  await connection();
  const supabase = await createClient();
  const [{ data: banners }, { data: featured }] = await Promise.all([
    supabase.from("store_banners").select("id, image_path, title, product_id, position").eq("store_id", storeId).order("position").order("id"),
    supabase.from("store_featured").select("product_id").eq("store_id", storeId).order("position"),
  ]);
  return {
    banners: (banners ?? []).map((b) => ({ ...b, imageUrl: storeMediaUrl(b.image_path) })),
    featuredIds: (featured ?? []).map((f) => f.product_id),
  };
}
