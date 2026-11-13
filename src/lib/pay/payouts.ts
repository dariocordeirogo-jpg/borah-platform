import "server-only";
import { createAnonClient } from "@/lib/supabase/anon";
import { syncStripeObject } from "@/lib/pay/ingest";
import { signStripePayload } from "@/lib/pay/signature";
import { getStripe } from "@/lib/pay/stripe";

type Claimed = {
  payment_id: string;
  amount_cents: number;
  destination: string;
  payment_intent: string | null;
  transfer_group: string;
  order_number: number;
};

export type PayoutRun = { claimed: number; transferred: number; failed: number };

/**
 * Repasses da Compra Garantida: o banco entrega a fila de repasses liberados (entrega confirmada) e o servidor
 * transfere a parte de cada loja, já sem a comissão. Cada transferência volta ao banco como aviso assinado.
 * Seguro para rodar de novo: antes de transferir, confere se a transferência já existe no grupo da cobrança.
 */
export async function processDuePayouts(limit = 20): Promise<PayoutRun> {
  const run: PayoutRun = { claimed: 0, transferred: 0, failed: 0 };
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = await getStripe();
  if (!secret || !stripe) return run;

  const payload = JSON.stringify({ kind: "zexi.payout.claim", limit, at: Date.now() });
  const { data, error } = await createAnonClient().rpc("claim_payouts", {
    _payload: payload,
    _signature: signStripePayload(payload, secret),
  });
  if (error || !Array.isArray(data)) return run;
  const items = data as unknown as Claimed[];
  run.claimed = items.length;

  for (const p of items) {
    try {
      if (!p.payment_intent) throw new Error("sem cobrança vinculada");
      const existing = await stripe.transfers.list({ transfer_group: p.transfer_group, limit: 100 });
      let transfer = existing.data.find((t) => t.metadata?.payment_id === p.payment_id);
      if (!transfer) {
        // A cobrança que originou o dinheiro: a transferência só sai quando o valor dela estiver disponível
        const pi = await stripe.paymentIntents.retrieve(p.payment_intent);
        const charge = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;
        if (!charge) throw new Error("cobrança sem charge");
        transfer = await stripe.transfers.create(
          {
            amount: p.amount_cents,
            currency: "brl",
            destination: p.destination,
            transfer_group: p.transfer_group,
            source_transaction: charge,
            description: `Zexi · repasse do pedido #${p.order_number}`,
            metadata: { payment_id: p.payment_id },
          },
          { idempotencyKey: `payout_${p.payment_id}` },
        );
      }
      const res = await syncStripeObject("transfer.created", transfer, null);
      if (res?.result === "transferred" || res?.result === "already_transferred") run.transferred++;
      else run.failed++;
    } catch (e) {
      run.failed++;
      const message = e instanceof Error ? e.message : "erro desconhecido";
      await syncStripeObject("zexi.payout_failed", { payment_id: p.payment_id, error: message } as { id?: string }, null);
    }
  }
  return run;
}
