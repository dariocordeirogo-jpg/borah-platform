import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Cupons da loja (RLS: só a loja dona e a equipe leem). */
export async function getStoreCoupons(storeId: string) {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase
    .from("coupons")
    .select("id, code, kind, percent_off, amount_off_cents, min_subtotal_cents, max_uses, uses_count, ends_at, is_active, created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(200);
  return data ?? [];
}
