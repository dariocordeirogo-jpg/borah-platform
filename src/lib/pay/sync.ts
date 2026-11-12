import "server-only";
import { CONNECT_ACCOUNTS_API_VERSION, getStripe } from "@/lib/pay/stripe";
import { syncStripeObject } from "@/lib/pay/ingest";
import { accountStatusFromV2 } from "@/lib/pay/format";
import { createClient } from "@/lib/supabase/server";

/* Sincronizações chamadas na renderização das páginas (não são Server Actions). */

/** Volta do Checkout: confere a sessão direto na Stripe e sincroniza (o webhook pode chegar depois). */
export async function syncCheckoutReturn(sessionId: string) {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return;
  const stripe = await getStripe();
  if (!stripe) return;
  // A sessão existe na conta da loja: a conta vem do pagamento que o próprio comprador pode ler
  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("destination_account")
    .eq("checkout_session_id", sessionId)
    .maybeSingle();
  if (!payment) return;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {}, { stripeAccount: payment.destination_account });
    if (session.status === "complete") await syncStripeObject("checkout.session.completed", session, payment.destination_account);
  } catch {
    // Sem problema: o webhook confirma depois
  }
}

/** Atualiza a situação da conta lendo direto da Stripe (Accounts v2; usado na volta do cadastro). */
export async function syncPayoutAccount(storeId: string) {
  const stripe = await getStripe();
  if (!stripe) return;
  const supabase = await createClient();
  const { data: acct } = await supabase.from("store_payment_accounts").select("account_id").eq("store_id", storeId).maybeSingle();
  if (!acct) return;
  try {
    const account = await stripe.v2.core.accounts.retrieve(
      acct.account_id,
      { include: ["configuration.merchant", "requirements"] },
      { apiVersion: CONNECT_ACCOUNTS_API_VERSION },
    );
    await syncStripeObject("account.updated", accountStatusFromV2(account), acct.account_id);
  } catch {
    // O webhook account.updated atualiza depois
  }
}
