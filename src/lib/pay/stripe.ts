import "server-only";
import Stripe from "stripe";
import { stripeKeyMode } from "@/lib/pay/format";
import { createAnonClient } from "@/lib/supabase/anon";

/**
 * Stripe só no servidor. Sem STRIPE_SECRET_KEY o ZEXI PAY fica "em configuração".
 * Chave de produção (sk_live_/rk_live_) só funciona com a flag `payments` ligada no banco:
 * pagamento real exige autorização explícita.
 */

async function liveAuthorized(): Promise<boolean> {
  const { data } = await createAnonClient().from("feature_flags").select("enabled").eq("key", "payments").maybeSingle();
  return data?.enabled === true;
}

let cached: Stripe | null = null;

export async function getStripe(): Promise<Stripe | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  const mode = stripeKeyMode(key);
  if (!key || !mode) return null;
  if (mode === "live" && !(await liveAuthorized())) return null;
  cached ??= new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
    appInfo: { name: "Zexi" },
  });
  return cached;
}

/** O pagamento online está disponível neste ambiente? */
export async function payAvailable(): Promise<boolean> {
  return (await getStripe()) !== null && Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}
