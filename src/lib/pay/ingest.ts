import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createAnonClient } from "@/lib/supabase/anon";
import { signStripePayload } from "@/lib/pay/signature";
import { getStripe } from "@/lib/pay/stripe";

export type IngestResult = {
  result?: string;
  /** refund = devolver a cobrança inteira; refund_parts = devolver só a parte de algumas lojas */
  action?: "refund" | "refund_parts";
  payment_intent?: string | null;
  /** Conta da loja onde a cobrança aconteceu (cobrança direta antiga). Ausente na cobrança única da Zexi. */
  account?: string | null;
  refunds?: { payment_id: string; amount_cents: number }[];
  duplicate?: boolean;
};

/** Entrega um aviso (já assinado) ao banco, que confere a assinatura e aplica a mudança. */
export async function ingestStripeEvent(payload: string, signature: string) {
  const { data, error } = await createAnonClient().rpc("stripe_ingest_event", { _payload: payload, _signature: signature });
  return { data: (data ?? null) as IngestResult | null, error };
}

/** Devolve a parte de uma loja dentro da cobrança única (o aviso do reembolso fecha o ciclo no banco). */
export async function refundPart(paymentIntent: string, paymentId: string, amountCents: number) {
  const stripe = await getStripe();
  if (!stripe) throw new Error("pay_unavailable");
  const refund = await stripe.refunds.create(
    { payment_intent: paymentIntent, amount: amountCents, metadata: { payment_id: paymentId }, reason: "requested_by_customer" },
    { idempotencyKey: `refund_part_${paymentId}` },
  );
  await syncStripeObject("refund.updated", refund, null);
  return refund;
}

/**
 * Quando o banco pede devolução (pagou pedido cancelado ou valor diferente), o servidor reembolsa na Stripe.
 * O aviso que volta da Stripe fecha o ciclo no banco.
 */
export async function followUp(res: IngestResult | null) {
  if (!res?.action || !res.payment_intent) return;
  if (res.action === "refund_parts") {
    for (const r of res.refunds ?? []) await refundPart(res.payment_intent, r.payment_id, r.amount_cents);
    return;
  }
  const stripe = await getStripe();
  if (!stripe) return;
  if (res.account) {
    // Cobrança direta antiga: o reembolso sai da conta da loja e a comissão da Zexi volta junto
    await stripe.refunds.create(
      { payment_intent: res.payment_intent, refund_application_fee: true },
      { idempotencyKey: `refund_${res.payment_intent}`, stripeAccount: res.account },
    );
  } else {
    // Cobrança única da Zexi com valor errado: devolve tudo
    await stripe.refunds.create({ payment_intent: res.payment_intent }, { idempotencyKey: `refund_${res.payment_intent}` });
  }
}

type SyncType =
  | "checkout.session.completed"
  | "checkout.session.expired"
  | "account.updated"
  | "refund.updated"
  | "transfer.created"
  | "zexi.payout_failed";

/**
 * Sincroniza um objeto lido agora da Stripe pelo servidor sem esperar o webhook.
 * O servidor tem o mesmo segredo dos webhooks, então assina e o banco confere como qualquer aviso.
 * `account` é a conta da loja onde o objeto existe (cobrança direta antiga); null = conta da Zexi.
 */
export async function syncStripeObject(type: SyncType, object: { id?: string; livemode?: boolean }, account: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return null;
  const body = JSON.stringify(object);
  // Avisos internos de falha podem se repetir (cada tentativa é um aviso novo)
  const id =
    type === "zexi.payout_failed"
      ? `evt_zexi_${randomUUID().replace(/-/g, "")}`
      : `evt_sync_${createHash("sha256").update(`${type}:${account ?? "platform"}:${body}`).digest("hex").slice(0, 32)}`;
  const event: Record<string, unknown> = { id, object: "event", type, livemode: Boolean(object.livemode), data: { object } };
  if (account) event.account = account;
  const payload = JSON.stringify(event);
  const { data, error } = await ingestStripeEvent(payload, signStripePayload(payload, secret));
  if (error) return null;
  await followUp(data);
  return data;
}
