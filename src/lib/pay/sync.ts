import "server-only";
import { getStripe } from "@/lib/pay/stripe";
import { syncStripeObject } from "@/lib/pay/ingest";
import { createClient } from "@/lib/supabase/server";

/* Sincronizações chamadas na renderização das páginas (não são Server Actions). */

/** Volta do Checkout: confere a sessão direto na Stripe e sincroniza (o webhook pode chegar depois). */
export async function syncCheckoutReturn(sessionId: string) {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return;
  const stripe = await getStripe();
  if (!stripe) return;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status === "complete") await syncStripeObject("checkout.session.completed", session);
  } catch {
    // Sem problema: o webhook confirma depois
  }
}

/** Atualiza a situação da conta lendo direto da Stripe (usado na volta do cadastro). */
export async function syncPayoutAccount(storeId: string) {
  const stripe = await getStripe();
  if (!stripe) return;
  const supabase = await createClient();
  const { data: acct } = await supabase.from("store_payment_accounts").select("account_id").eq("store_id", storeId).maybeSingle();
  if (!acct) return;
  try {
    const account = await stripe.accounts.retrieve(acct.account_id);
    await syncStripeObject("account.updated", account);
  } catch {
    // O webhook account.updated atualiza depois
  }
}
