import "server-only";
import { hiddenStoreIds, notInList } from "@/lib/test-stores";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";
import { productImageUrl } from "@/lib/market/images";

export const PAGE_SIZE = 24;
export type SortKey = "recentes" | "menor-preco" | "maior-preco";

export type ProductCardData = {
  id: string;
  title: string;
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
  condition: Enums<"product_condition">;
  imageUrl: string | null;
  store: { name: string; slug: string } | null;
};

const CARD_SELECT =
  "id, title, price_cents, compare_at_cents, stock, condition, product_images(path, position), stores(name, slug)" as const;

type CardRow = {
  id: string;
  title: string;
  price_cents: number;
  compare_at_cents: number | null;
  stock: number;
  condition: Enums<"product_condition">;
  product_images: { path: string; position: number }[] | null;
  stores: { name: string; slug: string } | null;
};

function toCard(r: CardRow): ProductCardData {
  const first = [...(r.product_images ?? [])].sort((a, b) => a.position - b.position)[0];
  return {
    id: r.id,
    title: r.title,
    priceCents: r.price_cents,
    compareAtCents: r.compare_at_cents,
    stock: r.stock,
    condition: r.condition,
    imageUrl: first ? productImageUrl(first.path) : null,
    store: r.stores,
  };
}

/** Lê dados do banco sempre na requisição (nunca na pré-renderização). */
async function db() {
  await connection();
  return createClient();
}

export async function getCategories() {
  const supabase = await db();
  const { data } = await supabase.from("categories").select("id, slug, name").order("position");
  return data ?? [];
}

export async function listProducts(opts: {
  q?: string;
  categorySlug?: string;
  storeId?: string;
  sort?: SortKey;
  page?: number;
  limit?: number;
  minPriceCents?: number;
  maxPriceCents?: number;
  condition?: Enums<"product_condition">;
}) {
  const supabase = await db();
  const limit = opts.limit ?? PAGE_SIZE;
  const page = Math.max(1, opts.page ?? 1);

  let categoryId: number | undefined;
  if (opts.categorySlug) {
    const { data: cat } = await supabase.from("categories").select("id").eq("slug", opts.categorySlug).maybeSingle();
    if (!cat) return { items: [] as ProductCardData[], total: 0, page, pages: 0 };
    categoryId = cat.id;
  }

  let query = supabase.from("products").select(CARD_SELECT, { count: "exact" }).eq("status", "active");
  const hidden = await hiddenStoreIds(supabase);
  if (hidden.length) query = query.not("store_id", "in", notInList(hidden));
  if (categoryId) query = query.eq("category_id", categoryId);
  if (opts.storeId) query = query.eq("store_id", opts.storeId);
  if (opts.minPriceCents) query = query.gte("price_cents", opts.minPriceCents);
  if (opts.maxPriceCents) query = query.lte("price_cents", opts.maxPriceCents);
  if (opts.condition) query = query.eq("condition", opts.condition);
  if (opts.q) query = query.textSearch("search", opts.q, { type: "websearch", config: "portuguese" });

  if (opts.sort === "menor-preco") query = query.order("price_cents", { ascending: true });
  else if (opts.sort === "maior-preco") query = query.order("price_cents", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const from = (page - 1) * limit;
  const { data, count } = await query.range(from, from + limit - 1);
  const total = count ?? 0;
  return {
    items: ((data ?? []) as unknown as CardRow[]).map(toCard),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

export async function getProduct(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await db();
  const { data } = await supabase
    .from("products")
    .select(
      "id, title, description, price_cents, compare_at_cents, stock, condition, status, store_id, video_url, product_images(id, path, position), stores(id, name, slug, owner_id), categories(name, slug)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const images = [...(data.product_images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((i) => ({ id: i.id, path: i.path, url: productImageUrl(i.path) }));
  return { ...data, images };
}

export async function getStoreBySlug(slug: string) {
  const supabase = await db();
  const { data } = await supabase.from("stores").select("id, name, slug, description, created_at").eq("slug", slug).maybeSingle();
  return data;
}

// ---- Comprador ----

export async function getCart() {
  const supabase = await db();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("cart_items")
    .select(
      "quantity, product_id, products(id, title, price_cents, stock, status, product_images(path, position), stores(id, name, slug, owner_id))",
    )
    .eq("user_id", user.id)
    .order("added_at");
  type Line = {
    quantity: number;
    product_id: string;
    products: {
      id: string;
      title: string;
      price_cents: number;
      stock: number;
      status: Enums<"product_status">;
      product_images: { path: string; position: number }[];
      stores: { id: string; name: string; slug: string; owner_id: string } | null;
    } | null;
  };
  const lines = ((data ?? []) as unknown as Line[]).filter((l) => l.products);
  const items = lines.map((l) => {
    const p = l.products!;
    const first = [...p.product_images].sort((a, b) => a.position - b.position)[0];
    const problem =
      p.status !== "active"
        ? "Indisponível"
        : p.stores?.owner_id === user.id
          ? "Produto da sua loja"
          : p.stock < l.quantity
            ? p.stock === 0
              ? "Esgotado"
              : `Só ${p.stock} em estoque`
            : null;
    return {
      productId: p.id,
      title: p.title,
      priceCents: p.price_cents,
      quantity: l.quantity,
      stock: p.stock,
      imageUrl: first ? productImageUrl(first.path) : null,
      store: p.stores,
      lineTotalCents: p.price_cents * l.quantity,
      problem,
    };
  });
  return {
    items,
    totalCents: items.reduce((s, i) => s + i.lineTotalCents, 0),
    count: items.reduce((s, i) => s + i.quantity, 0),
    hasProblems: items.some((i) => i.problem),
  };
}

export async function getCartCount(): Promise<number> {
  const supabase = await db();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data } = await supabase.from("cart_items").select("quantity").eq("user_id", user.id);
  return (data ?? []).reduce((s, r) => s + r.quantity, 0);
}

export async function getMyAddresses() {
  const supabase = await db();
  const { data } = await supabase
    .from("addresses")
    .select("id, label, recipient, cep, street, number, complement, district, city, state, is_default")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  return data ?? [];
}

const ORDER_SELECT =
  "id, number, status, subtotal_cents, shipping_cents, shipping_service, shipping_days, discount_cents, coupon_code, total_cents, shipping_address, cancelled_reason, created_at, buyer_id, store_id, stores(name, slug, owner_id), order_items(id, title, unit_price_cents, quantity, product_id)" as const;

export async function getMyOrders() {
  const supabase = await db();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("orders").select(ORDER_SELECT).eq("buyer_id", user.id).order("created_at", { ascending: false });
  return data ?? [];
}

export async function getOrder(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await db();
  const { data } = await supabase.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
  return data;
}

// ---- Vendedor ----

export async function getMyStore() {
  const supabase = await db();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("stores")
    .select("id, name, slug, description, origin_cep, is_active, created_at")
    .eq("owner_id", user.id)
    .maybeSingle();
  return data;
}

export async function getSellerProducts(storeId: string) {
  const supabase = await db();
  const { data } = await supabase
    .from("products")
    .select("id, title, price_cents, stock, status, updated_at, product_images(path, position)")
    .eq("store_id", storeId)
    .order("updated_at", { ascending: false });
  return (data ?? []).map((p) => {
    const first = [...p.product_images].sort((a, b) => a.position - b.position)[0];
    return { ...p, imageUrl: first ? productImageUrl(first.path) : null };
  });
}

export async function getSellerProduct(storeId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await db();
  const { data } = await supabase
    .from("products")
    .select(
      "id, title, description, price_cents, compare_at_cents, stock, weight_grams, condition, status, category_id, video_url, product_images(id, path, position)",
    )
    .eq("store_id", storeId)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    ...data,
    images: [...data.product_images]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ id: i.id, path: i.path, url: productImageUrl(i.path) })),
  };
}

export async function getSellerOrders(storeId: string) {
  const supabase = await db();
  const { data } = await supabase
    .from("orders")
    .select("id, number, status, total_cents, coupon_code, created_at, shipping_address, order_items(title, quantity, unit_price_cents)")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getSellerStats(storeId: string) {
  const supabase = await db();
  const [active, all, orders, low] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("status", "active"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    supabase.from("orders").select("total_cents, status").eq("store_id", storeId),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("status", "active").lte("stock", 2),
  ]);
  const valid = (orders.data ?? []).filter((o) => o.status !== "cancelled");
  return {
    activeProducts: active.count ?? 0,
    totalProducts: all.count ?? 0,
    orders: valid.length,
    pendingOrders: valid.filter((o) => o.status === "pending_payment").length,
    gmvCents: valid.reduce((s, o) => s + o.total_cents, 0),
    lowStock: low.count ?? 0,
  };
}
