/**
 * Entregas de ponta a ponta: pedido pago (aviso assinado, sem chamar a Stripe) → loja marca como enviado na central de
 * vendas → comprador acompanha em "Minhas compras", vê o rastreio e confirma o recebimento.
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

test.describe("Entregas: central de vendas e minhas compras", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "roda uma vez (desktop)"));

  const run = Date.now();
  const title = `Mochila Entrega E2E ${run}`;
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
      id: `evt_e2e_ent_acc_${run}`,
      object: "event",
      type: "account.updated",
      livemode: false,
      account: account,
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
      .insert({ store_id: store.id, title, price_cents: 9900, stock: 2, status: "active" })
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
    const { data: o } = await buyer.c.from("orders").select("number, total_cents").eq("id", orderId).single();
    orderNumber = o!.number;

    // Pagamento confirmado por aviso assinado (como a Stripe faria)
    const { data: start, error: se } = await buyer.c.rpc("start_order_payment", { _order_id: orderId });
    if (se || !start) throw new Error(`pagamento: ${se?.message}`);
    const st = start as { payment_id: string; destination: string; amount_cents: number };
    const paid = signed({
      id: `evt_e2e_ent_paid_${run}`,
      object: "event",
      type: "checkout.session.completed",
      livemode: false,
      account: st.destination,
      data: {
        object: {
          id: `cs_test_ent${run}`,
          client_reference_id: st.payment_id,
          metadata: { payment_id: st.payment_id },
          amount_total: st.amount_cents,
          currency: "brl",
          payment_status: "paid",
          payment_intent: `pi_e2e_ent_${run}`,
        },
      },
    });
    const res = await request.post("/api/webhooks/stripe", { data: paid.payload, headers: { "stripe-signature": paid.signature } });
    if ((await res.json()).result !== "paid") throw new Error("pedido não ficou pago");
  });

  test.afterAll(async () => {
    if (productId) await seller.c.from("products").update({ status: "paused" }).eq("id", productId);
  });

  test("loja vê a venda em “Para enviar” e informa o rastreio", async ({ browser }) => {
    const page = await browserAs(browser, SELLER, "/seller/pedidos");
    await expect(page.getByRole("heading", { name: "Vendas", level: 1 })).toBeVisible();
    const venda = page.getByTestId(`venda-${orderNumber}`);
    await expect(venda).toContainText("Pronta para enviar");
    await expect(venda).toContainText(title);
    await expect(venda).toContainText("Enviar para");

    await venda.getByLabel(`Código de rastreio do pedido ${orderNumber}`).fill("x");
    await venda.getByRole("button", { name: "Marcar como enviado" }).click();
    await expect(page.getByText(/Código de rastreio inválido/)).toBeVisible();

    await page.getByTestId(`venda-${orderNumber}`).getByLabel(`Código de rastreio do pedido ${orderNumber}`).fill("qa 123 456 789 br");
    await page.getByTestId(`venda-${orderNumber}`).getByRole("button", { name: "Marcar como enviado" }).click();
    await expect(page.getByText("Envio registrado. O comprador já pode acompanhar a entrega.")).toBeVisible();

    await page.goto("/seller/pedidos?aba=transito");
    const transito = page.getByTestId(`venda-${orderNumber}`);
    await expect(transito).toContainText("A caminho do comprador");
    await expect(transito.getByTestId("codigo-rastreio")).toHaveText("QA123456789BR");
    await page.context().close();
  });

  test("comprador acompanha em Minhas compras e confirma o recebimento", async ({ browser }) => {
    const page = await browserAs(browser, BUYER, "/conta/pedidos");
    const proximas = page.getByRole("region", { name: "Próximas entregas" });
    const compra = proximas.getByTestId(`compra-${orderNumber}`);
    await expect(compra).toContainText("A caminho");
    await expect(compra).toContainText("QA123456789BR");
    await compra.getByRole("link", { name: "Acompanhar" }).click();

    await expect(page.getByTestId("linha-do-tempo")).toContainText("A caminho");
    await expect(page.getByTestId("codigo-rastreio")).toHaveText("QA123456789BR");
    await page.getByRole("button", { name: "Já recebi" }).click();
    await expect(page.getByText("Obrigado por confirmar!")).toBeVisible();
    await expect(page.getByTestId("linha-do-tempo").locator('[aria-current="step"]')).toContainText("Entregue");

    await page.goto("/conta/pedidos");
    await expect(page.getByRole("region", { name: "Histórico de compras" }).getByTestId(`compra-${orderNumber}`)).toContainText("Entregue");
    await page.context().close();

    const sellerPage = await browserAs(browser, SELLER, "/seller/pedidos?aba=finalizadas");
    await expect(sellerPage.getByTestId(`venda-${orderNumber}`)).toContainText("Entregue em");
    await sellerPage.context().close();
  });
});
