import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function db() {
  await connection();
  return createClient();
}

/** Pagamentos do pedido visíveis ao usuário (comprador ou loja), mais recente primeiro. */
export async function getOrderPayments(orderId: string) {
  const supabase = await db();
  const { data } = await supabase
    .from("payments")
    .select("id, status, amount_cents, created_at, paid_at, refunded_at, needs_refund, checkout_payment_id")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function storeAcceptsPayments(storeId: string) {
  const supabase = await db();
  const { data } = await supabase.rpc("store_accepts_payments", { _store_id: storeId });
  return data === true;
}

export async function getFeeBps() {
  const supabase = await db();
  const { data } = await supabase.rpc("platform_fee_bps");
  return typeof data === "number" ? data : null;
}

export async function getMyPayoutAccount(storeId: string) {
  const supabase = await db();
  const { data } = await supabase
    .from("store_payment_accounts")
    .select("account_id, verified, charges_enabled, payouts_enabled, details_submitted, requirements_due, updated_at")
    .eq("store_id", storeId)
    .maybeSingle();
  return data;
}

export async function getStorePayments(storeId: string) {
  const supabase = await db();
  const { data } = await supabase
    .from("payments")
    .select("id, order_id, status, amount_cents, fee_cents, net_cents, created_at, paid_at, refunded_at, needs_refund, payout_status, transferred_at, orders(number)")
    .eq("store_id", storeId)
    .in("status", ["processing", "succeeded", "refunded", "failed"])
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}
