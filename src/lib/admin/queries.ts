import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function db() {
  await connection();
  return createClient();
}

export type Overview = {
  users: number;
  stores_active: number;
  stores_suspended: number;
  products_active: number;
  products_blocked: number;
  orders: Record<string, number>;
  gmv_cents: number;
  fees_cents: number;
  refunded_cents: number;
  needs_refund: number;
  affiliate_confirmed_cents: number;
  auctions_active: number;
  lives_now: number;
  videos_published: number;
  reports_open: number;
};

export async function getOverview(): Promise<Overview | null> {
  const supabase = await db();
  const { data } = await supabase.rpc("admin_overview");
  return (data as Overview | null) ?? null;
}

export async function getOpenReports() {
  const supabase = await db();
  const { data } = await supabase
    .from("reports")
    .select("id, kind, target_id, reason, details, created_at")
    .eq("status", "open")
    .order("created_at")
    .limit(100);
  return data ?? [];
}

export async function getModerationQueue() {
  const supabase = await db();
  const [{ data: videos }, { data: lives }, { data: blocked }] = await Promise.all([
    supabase
      .from("videos")
      .select("id, caption, created_at, stores(name), products(title)")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("lives")
      .select("id, title, status, scheduled_at, stores(name)")
      .in("status", ["live", "scheduled"])
      .order("scheduled_at")
      .limit(30),
    supabase.from("products").select("id, title, blocked_reason, stores(name)").not("blocked_reason", "is", null).limit(50),
  ]);
  return { videos: videos ?? [], lives: lives ?? [], blocked: blocked ?? [] };
}

export async function getStores() {
  const supabase = await db();
  const { data } = await supabase
    .from("stores")
    .select("id, name, slug, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  return data ?? [];
}

export async function getRecentOrders() {
  const supabase = await db();
  const { data } = await supabase
    .from("orders")
    .select("id, number, status, total_cents, created_at, stores(name), payments(status, needs_refund)")
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}
