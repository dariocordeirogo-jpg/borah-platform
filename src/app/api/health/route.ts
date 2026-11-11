import { connection } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";

/**
 * Saúde do sistema para monitoramento (ex.: UptimeRobot, Vercel Checks).
 * Não expõe segredo: só diz se o banco responde e quais integrações estão configuradas.
 */
export async function GET() {
  await connection(); // sempre na hora do pedido, nunca pré-renderizado no build
  const started = Date.now();
  const { error } = await createAnonClient().from("feature_flags").select("key").limit(1);
  const body = {
    ok: !error,
    db: error ? "erro" : "ok",
    db_ms: Date.now() - started,
    integrations: {
      stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
      ai: Boolean(process.env.ANTHROPIC_API_KEY),
    },
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  };
  return Response.json(body, { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
