import "server-only";
import { connection } from "next/server";
import type { Complaint } from "@/lib/complaints/format";
import { createClient } from "@/lib/supabase/server";

const COLS = "id, order_id, reason, details, status, created_at, resolved_at";

/** Reclamação de um pedido (só comprador, loja e equipe enxergam: RLS). */
export async function getOrderComplaint(orderId: string): Promise<Complaint | null> {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.from("order_complaints").select(COLS).eq("order_id", orderId).maybeSingle();
  return (data as Complaint | null) ?? null;
}

/** Reclamações recebidas pela loja (mais recentes primeiro). */
export async function getStoreComplaints(storeId: string, limit = 50) {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_complaints")
    .select(`${COLS}, orders(number)`)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as (Complaint & { orders: { number: number } | null })[];
}
