import "server-only";
import { createHash } from "node:crypto";
import { createAnonClient } from "@/lib/supabase/anon";
import { signStripePayload } from "@/lib/pay/signature";
import { getStripe } from "@/lib/pay/stripe";

export type IngestResult = { result?: string; action?: "refund"; payment_intent?: string | null; duplicate?: boolean };

/** Entrega um aviso (já assinado) ao banco, que confere a assinatura e aplica a mudança. */
export async function ingestStripeEvent(payload: string, signature: string) {
  const { data, error } = await createAnonClient().rpc("stripe_ingest_event", { _payload: payload, _signature: signature });
  return { data: (data ?? null) as IngestResult | null, error };
}

/**
 * Quando o banco pede devolução (pagou pedido cancelado ou valor diferente), o servidor reembolsa na Stripe.
 * O aviso charge.refunded que volta da Stripe fecha o ciclo no banco.
 */
export async function followUp(res: IngestResult | null) {
  if (res?.action !== "refund" || !res.payment_intent) return;
  const stripe = await getStripe();
  if (!stripe) return;
  await stripe.refunds.create(
    { payment_intent: res.payment_intent, reverse_transfer: true, refund_application_fee: true },
    { idempotencyKey: `refund_${res.payment_intent}` },
  );
}

/**
 * Sincroniza um objeto lido agora da Stripe pelo servidor (sessão ou conta) sem esperar o webhook.
 * O servidor tem o mesmo segredo dos webhooks, então assina e o banco confere como qualquer aviso.
 */
export async function syncStripeObject(type: "checkout.session.completed" | "checkout.session.expired" | "account.updated", object: { id: string; livemode?: boolean }) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return null;
  const body = JSON.stringify(object);
  const id = `evt_sync_${createHash("sha256").update(`${type}:${body}`).digest("hex").slice(0, 32)}`;
  const payload = JSON.stringify({ id, object: "event", type, livemode: Boolean(object.livemode), data: { object } });
  const { data, error } = await ingestStripeEvent(payload, signStripePayload(payload, secret));
  if (error) return null;
  await followUp(data);
  return data;
}
