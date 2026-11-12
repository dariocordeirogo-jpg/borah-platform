"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { payErrorMessage } from "@/lib/pay/format";
import { getStripe } from "@/lib/pay/stripe";
import { syncStripeObject } from "@/lib/pay/ingest";
import { createClient } from "@/lib/supabase/server";

const uuid = z.uuid();

type StartPayment = {
  payment_id: string;
  session_id: string | null;
  amount_cents: number;
  fee_cents: number;
  destination: string;
  order_number: number;
  store_name: string;
};

async function requireUser(next: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return { supabase, user };
}

function orderUrl(orderId: string, error?: string) {
  return `/conta/pedidos/${orderId}${error ? `?erro=${encodeURIComponent(error)}` : ""}`;
}

/**
 * Comprador paga um pedido: o banco calcula valor e comissão; o servidor abre o Checkout da Stripe
 * com a cobrança indo para a conta da loja (destination charge) e a comissão retida pela plataforma.
 */
export async function payOrder(formData: FormData) {
  const orderId = uuid.parse(formData.get("orderId"));
  const { supabase, user } = await requireUser(orderUrl(orderId));
  const stripe = await getStripe();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) redirect(orderUrl(orderId, payErrorMessage("pay_unavailable")));

  const { data, error } = await supabase.rpc("start_order_payment", { _order_id: orderId });
  if (error || !data) redirect(orderUrl(orderId, payErrorMessage(error?.message)));
  const p = data as unknown as StartPayment;

  let url: string | null = null;
  try {
    if (p.session_id) {
      const existing = await stripe.checkout.sessions.retrieve(p.session_id);
      if (existing.status === "open") url = existing.url;
      else if (existing.status === "complete") await syncStripeObject("checkout.session.completed", existing);
      else await syncStripeObject("checkout.session.expired", existing);
    } else {
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          currency: "brl",
          locale: "pt-BR",
          client_reference_id: p.payment_id,
          customer_email: user.email,
          metadata: { payment_id: p.payment_id, order_id: orderId },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "brl",
                unit_amount: p.amount_cents,
                product_data: { name: `Pedido #${p.order_number} · ${p.store_name}` },
              },
            },
          ],
          payment_intent_data: {
            application_fee_amount: p.fee_cents,
            transfer_data: { destination: p.destination },
            metadata: { payment_id: p.payment_id, order_id: orderId },
            description: `Zexi · Pedido #${p.order_number}`,
          },
          // A sessão expira antes do registro no banco (60 min)
          expires_at: Math.floor(Date.now() / 1000) + 55 * 60,
          success_url: `${env.NEXT_PUBLIC_SITE_URL}/conta/pedidos/${orderId}?pagamento=retorno&sessao={CHECKOUT_SESSION_ID}`,
          cancel_url: `${env.NEXT_PUBLIC_SITE_URL}/conta/pedidos/${orderId}?pagamento=cancelado`,
        },
        { idempotencyKey: `checkout_${p.payment_id}` },
      );
      await supabase.rpc("attach_checkout_session", { _payment_id: p.payment_id, _session_id: session.id });
      url = session.url;
    }
  } catch {
    redirect(orderUrl(orderId, payErrorMessage("stripe_error")));
  }
  // Sessão anterior já fechada: o pedido mostra o novo estado e o comprador tenta de novo se preciso
  redirect(url ?? orderUrl(orderId));
}

async function requireSellerStore() {
  const { supabase, user } = await requireUser("/seller/pagamentos");
  const { data: store } = await supabase.from("stores").select("id, name, slug").eq("owner_id", user.id).maybeSingle();
  if (!store) redirect("/vender");
  return { supabase, user, store };
}

/** Vendedor conecta (ou continua o cadastro da) conta de recebimento na Stripe. */
export async function connectPayoutAccount() {
  const { supabase, user, store } = await requireSellerStore();
  const stripe = await getStripe();
  if (!stripe) redirect(`/seller/pagamentos?erro=${encodeURIComponent(payErrorMessage("pay_unavailable"))}`);

  let linkUrl: string;
  try {
    const { data: current } = await supabase.from("store_payment_accounts").select("account_id").eq("store_id", store.id).maybeSingle();
    let accountId = current?.account_id;
    if (!accountId) {
      const account = await stripe.accounts.create(
        {
          type: "express",
          country: "BR",
          email: user.email,
          business_profile: { name: store.name, url: `${env.NEXT_PUBLIC_SITE_URL}/loja/${store.slug}` },
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          metadata: { store_id: store.id },
        },
        { idempotencyKey: `acct_${store.id}` },
      );
      const { data: registered, error } = await supabase.rpc("register_payout_account", { _account_id: account.id });
      if (error || !registered) throw new Error(error?.message ?? "register_failed");
      accountId = registered;
    }
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${env.NEXT_PUBLIC_SITE_URL}/seller/pagamentos?refazer=1`,
      return_url: `${env.NEXT_PUBLIC_SITE_URL}/seller/pagamentos?retorno=1`,
    });
    linkUrl = link.url;
  } catch (e) {
    const msg = e instanceof Error ? e.message : undefined;
    redirect(`/seller/pagamentos?erro=${encodeURIComponent(payErrorMessage(msg?.startsWith("store_") ? msg : "stripe_error"))}`);
  }
  redirect(linkUrl);
}

/** Vendedor abre o painel Express da Stripe (saldo, repasses, dados bancários). */
export async function openPayoutDashboard() {
  const { supabase, store } = await requireSellerStore();
  const stripe = await getStripe();
  const { data: acct } = await supabase.from("store_payment_accounts").select("account_id").eq("store_id", store.id).maybeSingle();
  if (!stripe || !acct) redirect("/seller/pagamentos");
  let url: string;
  try {
    url = (await stripe.accounts.createLoginLink(acct.account_id)).url;
  } catch {
    redirect(`/seller/pagamentos?erro=${encodeURIComponent(payErrorMessage("stripe_error"))}`);
  }
  redirect(url);
}
