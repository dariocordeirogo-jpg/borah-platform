"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Entra no programa Indique e ganhe (idempotente) e abre o painel. */
export async function becomeAffiliate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?next=/indique");
  const { error } = await supabase.rpc("become_affiliate");
  if (error) redirect(`/indique?erro=${encodeURIComponent("Não foi possível entrar no programa agora. Tente de novo.")}`);
  revalidatePath("/", "layout");
  redirect("/conta/indicacoes?novo=1");
}
