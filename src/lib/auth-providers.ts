import "server-only";
import { connection } from "next/server";
import { env } from "@/lib/env";

/**
 * O login com Google está ligado no Supabase? (Authentication → Providers → Google).
 * Lê a configuração pública do Auth; enquanto estiver desligado, o botão não aparece (em vez de levar a um erro).
 */
export async function googleLoginEnabled(): Promise<boolean> {
  await connection();
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { external?: { google?: boolean } };
    return data.external?.google === true;
  } catch {
    return false;
  }
}
