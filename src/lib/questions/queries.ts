import "server-only";
import { connection } from "next/server";
import { productImageUrl } from "@/lib/market/images";
import { createClient } from "@/lib/supabase/server";

export type ProductQuestion = { id: number; asker_alias: string; body: string; answer: string | null; answered_at: string | null; created_at: string; mine: boolean };

/** Perguntas do produto: as respondidas primeiro (mais recentes), depois as de quem está vendo ainda sem resposta. */
export async function getProductQuestions(productId: string, limit = 20) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, count } = await supabase
    .from("product_questions")
    .select("id, asker_id, asker_alias, body, answer, answered_at, created_at", { count: "exact" })
    .eq("product_id", productId)
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? [])
    .map(({ asker_id, ...q }) => ({ ...q, mine: !!user && asker_id === user.id }))
    // Sem resposta, só quem perguntou vê (os outros só veem perguntas já respondidas)
    .filter((q) => q.answer || q.mine);
  return { questions: rows as ProductQuestion[], total: count ?? rows.length };
}

/** Painel da loja: perguntas dos produtos dela (sem resposta primeiro). */
export async function getStoreQuestions(storeId: string) {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_questions")
    .select("id, asker_alias, body, answer, answered_at, created_at, products(id, title, product_images(path, position))")
    .eq("store_id", storeId)
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []).map((q) => {
    const first = [...(q.products?.product_images ?? [])].sort((a, b) => a.position - b.position)[0];
    return { ...q, product: q.products ? { id: q.products.id, title: q.products.title, imageUrl: first ? productImageUrl(first.path) : null } : null };
  });
  return { open: rows.filter((q) => !q.answer), answered: rows.filter((q) => q.answer) };
}

export async function countOpenQuestions(storeId: string) {
  await connection();
  const supabase = await createClient();
  const { count } = await supabase
    .from("product_questions")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("hidden", false)
    .is("answer", null);
  return count ?? 0;
}
