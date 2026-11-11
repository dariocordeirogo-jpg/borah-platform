import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function db() {
  await connection();
  return createClient();
}

export type AffiliateProgram = { rate_bps: number; cookie_days: number };

export async function getAffiliateProgram(): Promise<AffiliateProgram | null> {
  const supabase = await db();
  const { data } = await supabase.rpc("affiliate_program");
  return (data as AffiliateProgram | null) ?? null;
}

export async function getMyAffiliate() {
  const supabase = await db();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("affiliates").select("code, is_active, created_at").eq("user_id", user.id).maybeSingle();
  return data;
}

/** Painel do afiliado: cliques dos últimos 30 dias e comissões. */
export async function getAffiliateDashboard() {
  const supabase = await db();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [{ data: clicks }, { data: commissions }] = await Promise.all([
    supabase.from("affiliate_clicks").select("day, clicks").gte("day", since),
    supabase
      .from("affiliate_commissions")
      .select("id, order_number, base_cents, rate_bps, amount_cents, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const list = commissions ?? [];
  const sum = (s: string) => list.filter((c) => c.status === s).reduce((t, c) => t + c.amount_cents, 0);
  return {
    clicks30d: (clicks ?? []).reduce((t, c) => t + c.clicks, 0),
    orders: list.filter((c) => c.status !== "cancelled").length,
    pendingCents: sum("pending"),
    confirmedCents: sum("confirmed"),
    commissions: list,
  };
}
