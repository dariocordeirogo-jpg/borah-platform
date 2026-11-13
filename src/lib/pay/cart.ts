import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { syncStripeObject } from "@/lib/pay/ingest";
import { getStripe } from "@/lib/pay/stripe";
import type { Database } from "@/lib/supabase/database.types";

type StartCart = {
  checkout_payment_id: string;
  session_id: string | null;
  amount_cents: number;
  orders: { order_id: string; number: number; store_name: string; amount_cents: number }[];
};

export type CartCheckout = { url: string } | { done: true } | { error: string };

/**
 * Pagamento único (Compra Garantida): uma cobrança na conta da Zexi para todos os pedidos do carrinho.
 * O banco valida os pedidos e calcula valores e comissões; aqui só se abre o Checkout da Stripe.
 * O dinheiro de cada loja fica retido e é transferido depois da entrega (ver payouts.ts).
 */
export async function startCartCheckout(
  supabase: SupabaseClient<Database>,
  email: string | undefined,
  orderIds: string[],
  backPath: string,
): Promise<CartCheckout> {
  const stripe = await getStripe();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return { error: "pay_unavailable" };

  const { data, error } = await supabase.rpc("start_cart_payment", { _order_ids: orderIds });
  if (error || !data) return { error: error?.message ?? "unknown" };
  const c = data as unknown as StartCart;

  try {
    if (c.session_id) {
      const existing = await stripe.checkout.sessions.retrieve(c.session_id);
      if (existing.status === "open" && existing.url) return { url: existing.url };
      await syncStripeObject(existing.status === "complete" ? "checkout.session.completed" : "checkout.session.expired", existing, null);
      return { done: true };
    }
    const ref = `cp_${c.checkout_payment_id}`;
    const one = c.orders.length === 1 ? c.orders[0] : null;
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        currency: "brl",
        locale: "pt-BR",
        client_reference_id: c.checkout_payment_id,
        customer_email: email,
        metadata: { checkout_payment_id: c.checkout_payment_id },
        // Um item por loja: o comprador vê o que está pagando, mas paga uma vez só
        line_items: c.orders.map((o) => ({
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: o.amount_cents,
            product_data: { name: `Pedido #${o.number} · ${o.store_name}` },
          },
        })),
        payment_intent_data: {
          transfer_group: ref,
          metadata: { checkout_payment_id: c.checkout_payment_id },
          description: one ? `Zexi · Pedido #${one.number}` : `Zexi · ${c.orders.length} pedidos`,
        },
        // A sessão expira antes do registro no banco (60 min)
        expires_at: Math.floor(Date.now() / 1000) + 55 * 60,
        success_url: `${env.NEXT_PUBLIC_SITE_URL}${backPath}${backPath.includes("?") ? "&" : "?"}pagamento=retorno&sessao={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.NEXT_PUBLIC_SITE_URL}${backPath}${backPath.includes("?") ? "&" : "?"}pagamento=cancelado`,
      },
      { idempotencyKey: `checkout_${c.checkout_payment_id}` },
    );
    await supabase.rpc("attach_cart_session", { _checkout_payment_id: c.checkout_payment_id, _session_id: session.id });
    return session.url ? { url: session.url } : { error: "stripe_error" };
  } catch {
    return { error: "stripe_error" };
  }
}
