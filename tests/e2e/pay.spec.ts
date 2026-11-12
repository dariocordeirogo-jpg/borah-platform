/**
 * ZEXI PAY de ponta a ponta, sem chamar a Stripe: os avisos (webhooks) são simulados e assinados
 * com o segredo de desenvolvimento, e entram pela rota real /api/webhooks/stripe → banco.
 * A chamada à API da Stripe (abrir o Checkout, criar a conta da loja) fica para quando houver chave de teste.
 */
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://elygbieuroidqxkifgou.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_q6ee6uIuN9A8l8ni8wfngQ_NZc5L7Vn";
const PASSWORD = "Teste12345";
const SELLER = "e2e-vendedor@livelance.test";
const BUYER = process.env.E2E_EMAIL ?? "e2e@livelance.test";

function webhookSecret(): string {
  if (process.env.STRIPE_WEBHOOK_SECRET) return process.env.STRIPE_WEBHOOK_SECRET;
  const line = readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith("STRIPE_WEBHOOK_SECRET="));
  if (!line) throw new Error("STRIPE_WEBHOOK_SECRET ausente em .env.local");
  return line.slice("STRIPE_WEBHOOK_SECRET=".length).trim();
}

function signed(event: object) {
  const payload = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", webhookSecret()).update(`${t}.${payload}`).digest("hex");
  return { payload, signature: `t=${t},v1=${v1}` };
}

async function signIn(email: string) {
  const c = createClient<Database>(URL_SB, KEY, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.user) throw new Error(`login ${email}: ${error?.message}`);
  return { c, id: data.user.id };
}

async function browserAs(browser: Browser, email: string, next: string): Promise<Page> {
  const ctx = await browser.newContext({ ...test.info().project.use, locale: "pt-BR" });
  const page = await ctx.newPage();
  await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
  return page;
}

test.describe("ZEXI PAY: pedido pago pelo aviso assinado", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "roda uma vez (desktop)"));

  const run = Date.now();
  let seller: { c: SupabaseClient<Database>; id: string };
  let buyer: { c: SupabaseClient<Database>; id: string };
  let storeId = "";
  let accountId = "";
  let productId = "";
  let orderId = "";
  let orderNumber = 0;
  let paymentId = "";

  test.beforeAll(async () => {
    seller = await signIn(SELLER);
    buyer = await signIn(BUYER);
    const { data: store } = await seller.c.from("stores").select("id").eq("owner_id", seller.id).single();
    if (!store) throw new Error("vendedor de teste sem loja");
    storeId = store.id;
    const { data: acct, error } = await seller.c.rpc("register_payout_account", { _account_id: "acct_1E2ELOJATESTE" });
    if (error || !acct) throw new Error(`conta: ${error?.message}`);
    accountId = acct;
    const { data: p, error: pe } = await seller.c
      .from("products")
      .insert({ store_id: storeId, title: `Fone PAY E2E ${run}`, price_cents: 15000, stock: 1, status: "active" })
      .select("id")
      .single();
    if (pe) throw pe;
    productId = p.id;
  });

  test.afterAll(async () => {
    if (productId) await seller.c.from("products").update({ status: "paused" }).eq("id", productId);
  });

  test("webhook recusa aviso sem assinatura ou com assinatura errada", async ({ request }) => {
    const body = JSON.stringify({ id: `evt_e2e_bad_${run}`, type: "account.updated", data: { object: {} } });
    expect((await request.post("/api/webhooks/stripe", { data: body })).status()).toBe(400);
    const bad = await request.post("/api/webhooks/stripe", { data: body, headers: { "stripe-signature": "t=1,v1=00" } });
    expect(bad.status()).toBe(400);
  });

  test("aviso assinado ativa a conta de recebimento da loja", async ({ request, browser }) => {
    const { payload, signature } = signed({
      id: `evt_e2e_acc_${run}`,
      object: "event",
      type: "account.updated",
      livemode: false,
      data: {
        object: {
          id: accountId,
          object: "account",
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
          requirements: { currently_due: [] },
          metadata: { store_id: storeId },
        },
      },
    });
    const res = await request.post("/api/webhooks/stripe", { data: payload, headers: { "stripe-signature": signature, "content-type": "application/json" } });
    expect(res.status()).toBe(200);
    expect((await res.json()).result).toBe("account_updated");

    const page = await browserAs(browser, SELLER, "/seller/pagamentos");
    await expect(page.getByRole("heading", { name: "Pagamentos" })).toBeVisible();
    await expect(page.getByTestId("estado-recebimento")).toHaveText("Recebimentos ativos");
    await page.context().close();
  });

  test("comprador vê a caixa de pagamento do pedido", async ({ browser }) => {
    const { data: addrs } = await buyer.c.from("addresses").select("id").eq("user_id", buyer.id).limit(1);
    let addressId = addrs?.[0]?.id;
    if (!addressId) {
      const { data: a, error } = await buyer.c
        .from("addresses")
        .insert({ user_id: buyer.id, recipient: "Ana E2E", cep: "01001000", street: "Praça da Sé", number: "1", district: "Sé", city: "São Paulo", state: "SP" })
        .select("id")
        .single();
      if (error) throw error;
      addressId = a.id;
    }
    await buyer.c.from("cart_items").delete().eq("user_id", buyer.id);
    await buyer.c.from("cart_items").insert({ user_id: buyer.id, product_id: productId, quantity: 1 });
    const { data: orders, error } = await buyer.c.rpc("checkout", { _address_id: addressId });
    if (error || !orders?.length) throw new Error(`checkout: ${error?.message}`);
    orderId = orders[0];
    const { data: o } = await buyer.c.from("orders").select("number").eq("id", orderId).single();
    orderNumber = o!.number;

    const page = await browserAs(browser, BUYER, `/conta/pedidos/${orderId}`);
    const box = page.getByRole("region", { name: "Pagamento" });
    await expect(box).toBeVisible();
    // Sem chave Stripe neste ambiente: nada de botão de pagar, só o aviso
    await expect(box.getByText("O ZEXI PAY está em configuração")).toBeVisible();
    await expect(page.getByRole("button", { name: /Pagar R\$/ })).toHaveCount(0);
    await page.context().close();
  });

  test("aviso de pagamento confirmado marca o pedido como pago", async ({ request, browser }) => {
    const { data: start, error } = await buyer.c.rpc("start_order_payment", { _order_id: orderId });
    if (error || !start) throw new Error(`pagamento: ${error?.message}`);
    paymentId = (start as { payment_id: string; fee_cents: number }).payment_id;
    expect((start as { fee_cents: number }).fee_cents).toBe(1500);

    const session = {
      id: `cs_test_e2e${run}`,
      object: "checkout.session",
      client_reference_id: paymentId,
      metadata: { payment_id: paymentId, order_id: orderId },
      amount_total: 15000,
      currency: "brl",
      payment_status: "paid",
      status: "complete",
      payment_intent: `pi_e2e_${run}`,
    };
    // Cobrança direta: o aviso vem da conta da loja (campo "account")
    const evt = { id: `evt_e2e_paid_${run}`, object: "event", type: "checkout.session.completed", livemode: false, account: accountId, data: { object: session } };
    const first = signed(evt);
    const res = await request.post("/api/webhooks/stripe", { data: first.payload, headers: { "stripe-signature": first.signature } });
    expect((await res.json()).result).toBe("paid");
    // A Stripe reenviando o mesmo aviso não muda nada
    const again = signed(evt);
    const dup = await request.post("/api/webhooks/stripe", { data: again.payload, headers: { "stripe-signature": again.signature } });
    expect((await dup.json()).duplicate).toBe(true);

    const page = await browserAs(browser, BUYER, `/conta/pedidos/${orderId}`);
    await expect(page.getByRole("heading", { name: `Pedido #${orderNumber}` })).toBeVisible();
    await expect(page.locator("main").getByText("Pago", { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("pagamento-status")).toContainText("Pago · R$ 150,00");
    await page.context().close();

    const sellerPage = await browserAs(browser, SELLER, "/seller/pagamentos");
    const row = sellerPage.getByRole("row", { name: new RegExp(`#${orderNumber}`) });
    await expect(row).toContainText("R$ 150,00");
    await expect(row).toContainText("R$ 15,00");
    await expect(row).toContainText("R$ 135,00");
    await sellerPage.context().close();
  });

  test("reembolso total cancela o pedido e devolve o estoque", async ({ request, browser }) => {
    const { payload, signature } = signed({
      id: `evt_e2e_ref_${run}`,
      object: "event",
      type: "charge.refunded",
      livemode: false,
      account: accountId,
      data: { object: { id: `ch_e2e_${run}`, object: "charge", payment_intent: `pi_e2e_${run}`, refunded: true } },
    });
    const res = await request.post("/api/webhooks/stripe", { data: payload, headers: { "stripe-signature": signature } });
    expect((await res.json()).result).toBe("refunded");

    const { data: p } = await seller.c.from("products").select("stock").eq("id", productId).single();
    expect(p?.stock).toBe(1);
    const page = await browserAs(browser, BUYER, `/conta/pedidos/${orderId}`);
    await expect(page.locator("main").getByText("Cancelado", { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("pagamento-status")).toContainText("Reembolsado");
    await page.context().close();
  });
});
