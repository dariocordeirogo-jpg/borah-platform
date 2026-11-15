import "server-only";
import { connection } from "next/server";
import { CARD_SELECT, PAGE_SIZE, toCard, type CardRow } from "@/lib/market/queries";
import type { ProductCardData } from "@/lib/market/queries";
import type { OfferTab } from "@/lib/offers/format";
import { createClient } from "@/lib/supabase/server";
import { hiddenStoreIds, notInList } from "@/lib/test-stores";

export type FlashCard = ProductCardData & { endsAt: string };

/** Produtos em oferta (desconto calculado pelo banco), do maior desconto para o menor. */
export async function listOffers(opts: { tab: Exclude<OfferTab, "relampago">; categorySlug?: string; page?: number }) {
  await connection();
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  let categoryId: number | undefined;
  if (opts.categorySlug) {
    const { data: cat } = await supabase.from("categories").select("id").eq("slug", opts.categorySlug).maybeSingle();
    if (!cat) return { items: [] as ProductCardData[], total: 0, page, pages: 0 };
    categoryId = cat.id;
  }
  let query = supabase
    .from("products")
    .select(CARD_SELECT, { count: "exact" })
    .eq("status", "active")
    .eq("is_showcase", false)
    .not("discount_pct", "is", null);
  const hidden = await hiddenStoreIds(supabase);
  if (hidden.length) query = query.not("store_id", "in", notInList(hidden));
  if (categoryId) query = query.eq("category_id", categoryId);
  if (opts.tab === "30-off") query = query.gte("discount_pct", 30);
  if (opts.tab === "ate-50") query = query.lte("price_cents", 5000);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query
    .order("discount_pct", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  const total = count ?? 0;
  return { items: ((data ?? []) as unknown as CardRow[]).map(toCard), total, page, pages: Math.ceil(total / PAGE_SIZE) };
}

/** Ofertas relâmpago no ar (as que acabam primeiro aparecem antes). */
export async function listFlashDeals(limit = 48): Promise<FlashCard[]> {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase
    .from("flash_deals")
    .select(`ends_at, products!inner(${CARD_SELECT}, status, store_id)`)
    .eq("status", "active")
    .eq("products.status", "active")
    .gt("ends_at", new Date().toISOString())
    .order("ends_at", { ascending: true })
    .limit(limit);
  const hidden = new Set(await hiddenStoreIds(supabase));
  return ((data ?? []) as unknown as { ends_at: string; products: CardRow & { store_id?: string } }[])
    .filter((d) => !d.products.store_id || !hidden.has(d.products.store_id))
    .map((d) => ({ ...toCard(d.products), endsAt: d.ends_at }));
}

/** Ofertas relâmpago da própria loja (painel do vendedor). */
export async function getStoreFlashDeals(storeId: string) {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase
    .from("flash_deals")
    .select("id, product_id, deal_price_cents, starts_at, ends_at, status, original_price_cents, products(title)")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
