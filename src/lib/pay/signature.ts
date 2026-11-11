import { createHmac } from "node:crypto";

/**
 * Assina um payload no formato do cabeçalho Stripe-Signature ("t=<unix>,v1=<hex>").
 * O banco confere a mesma assinatura (private.stripe_signature_ok).
 */
export function signStripePayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${v1}`;
}
