import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  roles: string[];
};

/**
 * Camada de acesso a dados da sessão. Usa getUser() (valida o token no Supabase),
 * nunca getSession() sozinho, para decidir acesso.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // A sessão depende da requisição e do horário (validade do token): nunca entra na pré-renderização.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  return {
    id: user.id,
    email: user.email ?? null,
    displayName: profile?.display_name ?? user.email ?? "Usuário Zexi",
    avatarUrl: profile?.avatar_url ?? null,
    roles: (roles ?? []).map((r) => r.role as string),
  };
}
