import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Algum dos textos tem contato? Quem decide é o banco (a mesma regra que oculta ao gravar). */
export async function hasContact(supabase: Client, ...texts: (string | null | undefined)[]): Promise<boolean> {
  const joined = texts.filter(Boolean).join("\n");
  if (!joined.trim()) return false;
  const { data } = await supabase.rpc("contact_hidden", { _text: joined.slice(0, 20000) });
  return data === true;
}
