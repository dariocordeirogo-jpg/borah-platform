/**
 * Compra Garantida de ponta a ponta, sem chamar a Stripe: o comprador paga numa cobrança única da Zexi
 * (aviso assinado, sem "account"), o valor da loja fica retido, e é liberado quando o comprador confirma a entrega.
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

test.describe("Compra Garantida: pagamento único, dinheiro retido até a entrega", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "roda uma vez (desktop)"));

  const run = Date.now();
  const title = `Relógio Garantia E2E ${run}`;
  let seller: { c: SupabaseClient<Database>; id: string };
  let buyer: { c: SupabaseClient<Database>; id: string };
  let productId = "";
  let orderId = "";
  let orderNumber = 0;

  test.beforeAll(async ({ request }) => {
    seller = await signIn(SELLER);
    buyer = await signIn(BUYER);
    const { data: store } = await seller.c.from("stores").select("id").eq("owner_id", seller.id).single();
    if (!store) throw new Error("vendedor de teste sem loja");
    const { data: account } = await seller.c.rpc("register_payout_account", { _account_id: "acct_1E2ELOJATESTE" });
    const acc = signed({
      id: `evt_e2e_cg_acc_${run}`,
      object: "event",
      type: "account.updated",
      livemode: false,
      data: {
        object: {
          id: account,
          object: "account",
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
          requirements: { currently_due: [] },
          metadata: { store_id: store.id },
        },
      },
    });
    await request.post("/api/webhooks/stripe", { data: acc.payload, headers: { "stripe-signature": acc.signature } });

    const { data: p, error: pe } = await seller.c
      .from("products")
      .insert({ store_id: store.id, title, price_cents: 25900, stock: 2, status: "active" })
      .select("id")
      .single();
    if (pe) throw pe;
    productId = p.id;

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
  });

  test.afterAll(async () => {
    if (productId) await seller.c.from("products").update({ status: "paused" }).eq("id", productId);
  });

  test("uma cobrança na conta da Zexi paga o pedido e retém o valor da loja", async ({ request, browser }) => {
    const { data: start, error } = await buyer.c.rpc("start_cart_payment", { _order_ids: [orderId] });
    if (error || !start) throw new Error(`pagamento: ${error?.message}`);
    const s = start as { checkout_payment_id: string; amount_cents: number };
    // Aviso da conta da Zexi: sem o campo "account"
    const paid = signed({
      id: `evt_e2e_cg_paid_${run}`,
      object: "event",
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          id: `cs_test_cg${run}`,
          client_reference_id: s.checkout_payment_id,
          metadata: { checkout_payment_id: s.checkout_payment_id },
          amount_total: s.amount_cents,
          currency: "brl",
          payment_status: "paid",
          payment_intent: `pi_e2e_cg_${run}`,
        },
      },
    });
    const res = await request.post("/api/webhooks/stripe", { data: paid.payload, headers: { "stripe-signature": paid.signature } });
    expect((await res.json()).result).toBe("paid");

    const page = await browserAs(browser, SELLER, "/seller/pedidos");
    const venda = page.getByTestId(`venda-${orderNumber}`);
    await expect(venda).toContainText("Pronta para enviar");
    await expect(venda.getByTestId("repasse")).toContainText("Retido até a entrega");
    await expect(venda.getByRole("button", { name: "Cancelar e devolver ao comprador" })).toBeVisible();

    await page.goto("/seller/pagamentos");
    await expect(page.getByTestId("resumo-recebimentos")).toContainText("A liberar (até a entrega)");
    await page.context().close();
  });

  test("entrega confirmada libera o repasse", async ({ browser }) => {
    const { error: se } = await seller.c.rpc("ship_order", { _order_id: orderId, _carrier: "correios", _tracking_code: "CG123456789BR" });
    if (se) throw se;
    const page = await browserAs(browser, BUYER, `/conta/pedidos/${orderId}`);
    await page.getByRole("button", { name: "Já recebi" }).click();
    await expect(page.getByText("Obrigado por confirmar!")).toBeVisible();
    await page.context().close();

    const sellerPage = await browserAs(browser, SELLER, "/seller/pedidos?aba=finalizadas");
    // Sem chave da Stripe no teste, a transferência fica na fila (liberado)
    await expect(sellerPage.getByTestId(`venda-${orderNumber}`).getByTestId("repasse")).toContainText(/Liberado · transferindo|Transferido/);
    await sellerPage.context().close();
  });
});
