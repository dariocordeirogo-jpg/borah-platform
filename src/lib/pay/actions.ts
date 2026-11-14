"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { payErrorMessage } from "@/lib/pay/format";
import { startCartCheckout } from "@/lib/pay/cart";
import { refundPart } from "@/lib/pay/ingest";
import { CONNECT_ACCOUNTS_API_VERSION, getStripe } from "@/lib/pay/stripe";
import { createClient } from "@/lib/supabase/server";

const uuid = z.uuid();

async function requireUser(next: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return { supabase, user };
}

function withError(path: string, error: string) {
  return `${path}${path.includes("?") ? "&" : "?"}erro=${encodeURIComponent(payErrorMessage(error))}`;
}

/**
 * Comprador paga um pedido. Usa a cobrança única da Zexi (Compra Garantida): o banco calcula valor e comissão,
 * o servidor abre o Checkout da Stripe e o dinheiro da loja fica retido até a entrega.
 */
export async function payOrder(formData: FormData) {
  const orderId = uuid.parse(formData.get("orderId"));
  const back = `/conta/pedidos/${orderId}`;
  const { supabase, user } = await requireUser(back);
  const r = await startCartCheckout(supabase, user.email, [orderId], back);
  if ("error" in r) redirect(withError(back, r.error));
  redirect("url" in r ? r.url : back);
}

/** Comprador paga vários pedidos (um por loja) de uma vez só. */
export async function payCart(formData: FormData) {
  const ids = z.array(uuid).min(1).max(20).safeParse(formData.getAll("orderId"));
  const back = "/conta/pedidos";
  const { supabase, user } = await requireUser(back);
  if (!ids.success) redirect(withError(back, "order_not_found"));
  const r = await startCartCheckout(supabase, user.email, ids.data, back);
  if ("error" in r) redirect(withError(back, r.error));
  redirect("url" in r ? r.url : back);
}

/**
 * Loja cancela uma venda paga que ainda não enviou: o banco autoriza e marca; a Stripe devolve só a parte
 * desta loja ao comprador. O aviso do reembolso cancela o pedido e devolve o estoque.
 */
export async function refundStoreOrder(formData: FormData) {
  const orderId = uuid.parse(formData.get("orderId"));
  const back = "/seller/pedidos?aba=enviar";
  const { supabase } = await requireUser(back);
  const { data, error } = await supabase.rpc("request_order_refund", { _order_id: orderId });
  if (error || !data) redirect(withError(back, error?.message ?? "unknown"));
  const r = data as unknown as { payment_id: string; payment_intent: string | null; amount_cents: number };
  try {
    if (!r.payment_intent) throw new Error("no_intent");
    await refundPart(r.payment_intent, r.payment_id, r.amount_cents);
  } catch {
    // Fica marcado para devolução no banco (needs_refund) e a equipe conclui manualmente
    redirect(withError(back, "stripe_error"));
  }
  revalidatePath("/", "layout");
  redirect(`${back}&ok=${encodeURIComponent("Venda cancelada. O valor foi devolvido ao comprador.")}`);
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
      // Accounts v2 (Compra Garantida): a Zexi cobra o comprador e transfere para a loja depois da entrega.
      // A loja é recebedora (stripe_transfers), vê o painel Express; a Zexi responde por taxas e perdas.
      const account = await stripe.v2.core.accounts.create(
        {
          contact_email: user.email,
          display_name: store.name,
          dashboard: "express",
          identity: { country: "br" },
          defaults: {
            currency: "brl",
            locales: ["pt-BR"],
            profile: { business_url: `${env.NEXT_PUBLIC_SITE_URL}/loja/${store.slug}`, doing_business_as: store.name },
            responsibilities: { fees_collector: "application", losses_collector: "application" },
          },
          configuration: {
            // No Brasil a capacidade de receber transferências exige card_payments junto
            merchant: { capabilities: { card_payments: { requested: true } } },
            recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
          },
          metadata: { store_id: store.id },
        },
        { idempotencyKey: `acct_v2r_${store.id}`, apiVersion: CONNECT_ACCOUNTS_API_VERSION },
      );
      const { data: registered, error } = await supabase.rpc("register_payout_account", { _account_id: account.id });
      if (error || !registered) throw new Error(error?.message ?? "register_failed");
      accountId = registered;
    } else {
      // Conta criada antes da Compra Garantida: pede também a capacidade de receber transferências da Zexi
      await stripe.v2.core.accounts
        .update(
          accountId,
          { configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } } },
          { apiVersion: CONNECT_ACCOUNTS_API_VERSION },
        )
        .catch(() => undefined);
    }
    const link = await stripe.v2.core.accountLinks.create(
      {
        account: accountId,
        use_case: {
          type: "account_onboarding",
          account_onboarding: {
            refresh_url: `${env.NEXT_PUBLIC_SITE_URL}/seller/pagamentos?refazer=1`,
            return_url: `${env.NEXT_PUBLIC_SITE_URL}/seller/pagamentos?retorno=1`,
          },
        },
      },
      { apiVersion: CONNECT_ACCOUNTS_API_VERSION },
    );
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
