import "server-only";
import { hiddenStoreIds, notInList } from "@/lib/test-stores";
import { connection } from "next/server";
import { productImageUrl } from "@/lib/market/images";
import { createClient } from "@/lib/supabase/server";
import { videoUrl } from "@/lib/videos/url";

async function db() {
  await connection();
  return createClient();
}

export type FeedVideo = {
  id: string;
  url: string;
  caption: string | null;
  likes: number;
  views: number;
  liked: boolean;
  store: { name: string; slug: string };
  product: { id: string; title: string; priceCents: number; stock: number; imageUrl: string | null };
};

/** Feed público: o RLS já esconde vídeos removidos, de loja inativa ou de produto fora de venda. */
export async function getFeed(limit = 20): Promise<{ videos: FeedVideo[]; loggedIn: boolean }> {
  const supabase = await db();
  const hidden = await hiddenStoreIds(supabase);
  const [{ data }, { data: auth }] = await Promise.all([
    supabase
      .from("videos")
      .select(
        "id, path, caption, likes_count, views_count, created_at, stores(name, slug), products(id, title, price_cents, stock, product_images(path, position))",
      )
      .eq("status", "published")
      .not("store_id", "in", notInList(hidden.length ? hidden : ["00000000-0000-0000-0000-000000000000"]))
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.auth.getUser(),
  ]);
  const rows = data ?? [];
  let liked = new Set<string>();
  if (auth.user && rows.length) {
    const { data: likes } = await supabase.from("video_likes").select("video_id").in("video_id", rows.map((r) => r.id));
    liked = new Set((likes ?? []).map((l) => l.video_id));
  }
  const videos = rows
    .filter((r) => r.products && r.stores)
    .map((r) => {
      const first = [...(r.products!.product_images ?? [])].sort((a, b) => a.position - b.position)[0];
      return {
        id: r.id,
        url: videoUrl(r.path),
        caption: r.caption,
        likes: r.likes_count,
        views: r.views_count,
        liked: liked.has(r.id),
        store: r.stores!,
        product: {
          id: r.products!.id,
          title: r.products!.title,
          priceCents: r.products!.price_cents,
          stock: r.products!.stock,
          imageUrl: first ? productImageUrl(first.path) : null,
        },
      };
    });
  return { videos, loggedIn: Boolean(auth.user) };
}

export async function getSellerVideos(storeId: string) {
  const supabase = await db();
  const { data } = await supabase
    .from("videos")
    .select("id, path, caption, status, views_count, likes_count, created_at, products(title)")
    .eq("store_id", storeId)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  return (data ?? []).map((v) => ({ ...v, url: videoUrl(v.path) }));
}

export async function getVideoProducts(storeId: string) {
  const supabase = await db();
  const { data } = await supabase
    .from("products")
    .select("id, title")
    .eq("store_id", storeId)
    .eq("status", "active")
    .order("updated_at", { ascending: false });
  return data ?? [];
}
