import "server-only";
import { connection } from "next/server";
import type { Reputation } from "@/lib/reviews/format";
import { createClient } from "@/lib/supabase/server";

export type ProductReview = { id: number; buyer_alias: string; rating: number; comment: string | null; created_at: string };
export type RatingSummary = { avg: number; count: number; stars: number[] } | null;

/** Nota média, distribuição de estrelas e as avaliações mais recentes do produto. */
export async function getProductReviews(productId: string, limit = 10) {
  await connection();
  const supabase = await createClient();
  const [{ data: rating }, { data: reviews }] = await Promise.all([
    supabase.from("product_ratings").select("rating_avg, rating_count, stars").eq("product_id", productId).maybeSingle(),
    supabase
      .from("product_reviews")
      .select("id, buyer_alias, rating, comment, created_at")
      .eq("product_id", productId)
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);
  const summary: RatingSummary = rating ? { avg: Number(rating.rating_avg), count: rating.rating_count, stars: rating.stars } : null;
  return { summary, reviews: (reviews ?? []) as ProductReview[] };
}

const num = (v: number | string | null) => (v === null ? null : Number(v));

/** Reputação de várias lojas de uma vez (números agregados calculados pelo banco). */
export async function getStoreReputations(storeIds: string[]): Promise<Map<string, Reputation>> {
  const ids = [...new Set(storeIds)].slice(0, 50);
  const out = new Map<string, Reputation>();
  if (!ids.length) return out;
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.rpc("store_reputation", { _store_ids: ids });
  for (const r of data ?? []) {
    out.set(r.store_id, {
      sales: r.sales,
      complaintRate: num(r.complaint_rate),
      cancelRate: num(r.cancel_rate),
      delayRate: num(r.delay_rate),
      answerRate: num(r.answer_rate),
      ratingAvg: num(r.rating_avg),
      ratingCount: r.rating_count,
      color: r.color === "green" || r.color === "yellow" || r.color === "red" ? r.color : null,
    });
  }
  return out;
}

/** Avaliações que o comprador já deu nos itens de um pedido (para mostrar e editar). */
export async function getMyOrderReviews(orderId: string) {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.from("product_reviews").select("product_id, rating, comment").eq("order_id", orderId);
  return new Map((data ?? []).map((r) => [r.product_id, { rating: r.rating, comment: r.comment }]));
}
