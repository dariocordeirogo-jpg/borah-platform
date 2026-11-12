import "server-only";
import { hiddenStoreIds, notInList } from "@/lib/test-stores";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Row } from "@/lib/supabase/database.types";
import { productImageUrl } from "@/lib/market/images";

async function db() {
  await connection();
  return createClient();
}

export type AuctionTab = "andamento" | "programados" | "encerrados";

const CARD =
  "id, title, starting_price_cents, min_increment_cents, current_price_cents, bids_count, starts_at, ends_at, status, outcome, leader_alias, products(product_images(path, position)), stores(name, slug)" as const;

type CardRow = Pick<
  Row<"auctions">,
  | "id"
  | "title"
  | "starting_price_cents"
  | "min_increment_cents"
  | "current_price_cents"
  | "bids_count"
  | "starts_at"
  | "ends_at"
  | "status"
  | "outcome"
  | "leader_alias"
> & {
  products: { product_images: { path: string; position: number }[] } | null;
  stores: { name: string; slug: string } | null;
};

export type AuctionCardData = ReturnType<typeof toCard>;

function toCard(r: CardRow) {
  const img = [...(r.products?.product_images ?? [])].sort((a, b) => a.position - b.position)[0];
  return {
    id: r.id,
    title: r.title,
    currentCents: r.current_price_cents,
    nextMinCents: r.current_price_cents === null ? r.starting_price_cents : r.current_price_cents + r.min_increment_cents,
    startingCents: r.starting_price_cents,
    bidsCount: r.bids_count,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    status: r.status,
    outcome: r.outcome,
    leaderAlias: r.leader_alias,
    imageUrl: img ? productImageUrl(img.path) : null,
    store: r.stores,
  };
}

export async function listAuctions(tab: AuctionTab, limit = 48) {
  const supabase = await db();
  const now = new Date().toISOString();
  let q = supabase.from("auctions").select(CARD).limit(limit);
  const hidden = await hiddenStoreIds(supabase);
  if (hidden.length) q = q.not("store_id", "in", notInList(hidden));
  if (tab === "andamento") q = q.eq("status", "active").lte("starts_at", now).order("ends_at", { ascending: true });
  else if (tab === "programados") q = q.eq("status", "active").gt("starts_at", now).order("starts_at", { ascending: true });
  else q = q.eq("status", "ended").order("ended_at", { ascending: false });
  const { data } = await q;
  return { items: ((data ?? []) as unknown as CardRow[]).map(toCard), serverNow: now };
}

export async function getAuction(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await db();
  const [{ data: a }, { data: bids }, { data: status }] = await Promise.all([
    supabase
      .from("auctions")
      .select(
        "*, products(id, description, condition, product_images(id, path, position), categories(name, slug)), stores(name, slug)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("auction_bids").select("id, bidder_alias, amount_cents, created_at").eq("auction_id", id).order("id", { ascending: false }).limit(30),
    supabase.rpc("my_auction_status", { _auction_id: id }),
  ]);
  if (!a) return null;
  type Extra = {
    products: {
      id: string;
      description: string | null;
      condition: "new" | "used" | "refurbished";
      product_images: { id: string; path: string; position: number }[];
      categories: { name: string; slug: string } | null;
    } | null;
    stores: { name: string; slug: string } | null;
  };
  const full = a as unknown as Row<"auctions"> & Extra;
  return {
    auction: full,
    images: [...(full.products?.product_images ?? [])]
      .sort((x, y) => x.position - y.position)
      .map((i) => ({ id: i.id, url: productImageUrl(i.path) })),
    bids: bids ?? [],
    me: (status ?? null) as null | {
      logged_in: boolean;
      is_seller: boolean;
      is_leader: boolean | null;
      is_winner: boolean | null;
      blocker: string | null;
      my_max_cents: number | null;
    },
    serverNow: new Date().toISOString(),
  };
}

export async function getMyVerification() {
  const supabase = await db();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: v }, { data: block }] = await Promise.all([
    supabase.from("user_verifications").select("cpf_masked, phone, phone_verified_at, updated_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("bid_blocks").select("blocked_until, reason").eq("user_id", user.id).gt("blocked_until", new Date().toISOString()).maybeSingle(),
  ]);
  return { verification: v, block };
}

export async function getMyBids() {
  const supabase = await db();
  const { data } = await supabase.rpc("my_bids");
  return data ?? [];
}

export async function getSellerAuctions(storeId: string) {
  const supabase = await db();
  const { data } = await supabase
    .from("auctions")
    .select("id, title, status, outcome, current_price_cents, starting_price_cents, bids_count, starts_at, ends_at, relist_count, order_id")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getAuctionableProducts(storeId: string) {
  const supabase = await db();
  const { data } = await supabase
    .from("products")
    .select("id, title, stock, price_cents")
    .eq("store_id", storeId)
    .gte("stock", 1)
    .order("title");
  return data ?? [];
}
