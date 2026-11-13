import "server-only";
import { createHash } from "node:crypto";
import { createAnonClient } from "@/lib/supabase/anon";
import { signStripePayload } from "@/lib/pay/signature";
import { getStripe } from "@/lib/pay/stripe";

export type IngestResult = {
  result?: string;
  action?: "refund";
  payment_intent?: string | null;
  /** Conta da loja onde a cobrança aconteceu (cobrança direta) */
  account?: string | null;
  duplicate?: boolean;
};

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
  if (res?.action !== "refund" || !res.payment_intent || !res.account) return;
  const stripe = await getStripe();
  if (!stripe) return;
  // Cobrança direta: o reembolso sai da conta da loja e a comissão da Zexi volta junto
  await stripe.refunds.create(
    { payment_intent: res.payment_intent, refund_application_fee: true },
    { idempotencyKey: `refund_${res.payment_intent}`, stripeAccount: res.account },
  );
}

/**
 * Sincroniza um objeto lido agora da Stripe pelo servidor (sessão ou conta) sem esperar o webhook.
 * O servidor tem o mesmo segredo dos webhooks, então assina e o banco confere como qualquer aviso.
 * `account` é a conta da loja onde o objeto existe (como no campo "account" dos avisos do Connect).
 */
export async function syncStripeObject(
  type: "checkout.session.completed" | "checkout.session.expired" | "account.updated",
  object: { id: string; livemode?: boolean },
  account: string,
) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return null;
  const body = JSON.stringify(object);
  const id = `evt_sync_${createHash("sha256").update(`${type}:${account}:${body}`).digest("hex").slice(0, 32)}`;
  const payload = JSON.stringify({ id, object: "event", type, livemode: Boolean(object.livemode), account, data: { object } });
  const { data, error } = await ingestStripeEvent(payload, signStripePayload(payload, secret));
  if (error) return null;
  await followUp(data);
  return data;
}
