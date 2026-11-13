import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { site } from "@/lib/site";

/**
 * Lojas das contas de teste automático (stores.is_test, calculado pelo banco).
 * Em produção ficam fora das vitrines públicas; fora de produção (testes, preview) aparecem normalmente.
 */
export async function hiddenStoreIds(supabase: SupabaseClient): Promise<string[]> {
  if (!site.production) return [];
  const { data } = await supabase.from("stores").select("id").eq("is_test", true);
  return (data ?? []).map((r: { id: string }) => r.id);
}

/** Filtro PostgREST "store_id não está em (…)". */
export function notInList(ids: string[]) {
  return `(${ids.join(",")})`;
}
