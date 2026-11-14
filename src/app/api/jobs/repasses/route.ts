import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { processDuePayouts } from "@/lib/pay/payouts";

/**
 * Rotina agendada (Vercel Cron) que repassa às lojas o dinheiro das vendas entregues.
 * Só roda com o segredo CRON_SECRET (a Vercel envia "Authorization: Bearer <segredo>").
 * Quem decide o que pode ser repassado é o banco; esta rota só executa a fila.
 */
function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16 || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  await connection();
  if (!process.env.CRON_SECRET) return Response.json({ error: "not_configured" }, { status: 503 });
  if (!authorized(request.headers.get("authorization"))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const run = await processDuePayouts(50);
  return Response.json({ ok: true, ...run });
}
