/**
 * Indique e ganhe de ponta a ponta: afiliado entra no programa → compradora chega pelo link /r/<código>
 * e compra pela tela → comissão aparece pendente → aviso de pagamento (assinado) confirma → reembolso cancela.
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
const AFFILIATE = "e2e-comprador2@livelance.test";

function sign(event: object) {
  const secret =
    process.env.STRIPE_WEBHOOK_SECRET ??
    readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith("STRIPE_WEBHOOK_SECRET="))!.split("=")[1].trim();
  const payload = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  return { payload, signature: `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")}` };
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

test.describe("Indique e ganhe: venda indicada gera comissão", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "roda uma vez (desktop)"));

  const run = Date.now();
  const title = `Fone Indicação ${run}`;
  let seller: { c: SupabaseClient<Database>; id: string };
  let buyer: { c: SupabaseClient<Database>; id: string };
  let productId = "";
  let code = "";
  let orderId = "";
  let orderNumber = 0;

  test.beforeAll(async () => {
    seller = await signIn(SELLER);
    buyer = await signIn(BUYER);
    const { data: store } = await seller.c.from("stores").select("id").eq("owner_id", seller.id).single();
    const { data: p, error } = await seller.c
      .from("products")
      .insert({ store_id: store!.id, title, price_cents: 10000, stock: 2, status: "active" })
      .select("id")
      .single();
    if (error) throw error;
    productId = p.id;
    await buyer.c.from("cart_items").delete().eq("user_id", buyer.id);
  });

  test.afterAll(async () => {
    if (productId) await seller.c.from("products").update({ status: "paused" }).eq("id", productId);
  });

  test("afiliado entra no programa e gera link de produto", async ({ browser }) => {
    const page = await browserAs(browser, AFFILIATE, "/indique");
    await expect(page.getByRole("heading", { name: /Ganhe 3% em cada venda/ })).toBeVisible();
    const join = page.getByRole("button", { name: "Quero indicar e ganhar" });
    const open = page.getByRole("link", { name: "Abrir meu painel de indicações" });
    await expect(join.or(open)).toBeVisible();
    await ((await join.isVisible()) ? join : open).click();
    await expect(page).toHaveURL(/\/conta\/indicacoes/);
    code = (await page.getByTestId("codigo-afiliado").textContent())!.trim();
    expect(code).toMatch(/^[a-z0-9]{4,24}$/);
    await expect(page.getByTestId("link-geral")).toHaveValue(new RegExp(`/r/${code}$`));

    await page.getByLabel("Endereço de um produto, leilão ou loja").fill(`https://golpe.com/produto/${productId}`);
    await expect(page.getByText("Use um endereço da Zexi.")).toBeVisible();
    await page.getByLabel("Endereço de um produto, leilão ou loja").fill(`/produto/${productId}`);
    await expect(page.getByTestId("link-gerado")).toHaveValue(new RegExp(`/r/${code}\\?to=%2Fproduto%2F${productId}$`));
    await page.context().close();
  });

  test("link inválido só redireciona, sem cookie", async ({ browser }) => {
    const ctx = await browser.newContext({ ...test.info().project.use });
    const page = await ctx.newPage();
    await page.goto("/r/naoexiste999?to=/market");
    await expect(page).toHaveURL(/\/market$/);
    expect((await ctx.cookies()).find((c) => c.name === "ll_ref")).toBeUndefined();
    await page.goto("/r/qualquer?to=https://golpe.com");
    await expect(page).toHaveURL(/localhost:\d+\/$/);
    await ctx.close();
  });

  test("compradora chega pelo link e compra: comissão pendente", async ({ browser }) => {
    const ctx = await browser.newContext({ ...test.info().project.use, locale: "pt-BR" });
    const page = await ctx.newPage();
    await page.goto(`/r/${code}?to=${encodeURIComponent(`/produto/${productId}`)}`);
    await expect(page).toHaveURL(new RegExp(`/produto/${productId}$`));
    expect((await ctx.cookies()).find((c) => c.name === "ll_ref")?.value).toBe(code);

    await page.goto(`/entrar?next=${encodeURIComponent(`/produto/${productId}`)}`);
    await page.getByLabel("E-mail").fill(BUYER);
    await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/produto/${productId}$`));
    await page.getByRole("button", { name: "Comprar agora" }).click();
    await expect(page).toHaveURL(/\/carrinho$/);
    await page.getByRole("link", { name: "Finalizar compra" }).click();
    await expect(page.getByRole("heading", { name: "Seu pedido" })).toBeVisible();
    if (await page.getByLabel("Quem vai receber").isVisible()) {
      await page.getByLabel("Quem vai receber").fill("Compradora Teste");
      await page.getByLabel("CEP").fill("01001-000");
      await page.getByLabel("Rua").fill("Praça da Sé");
      await page.getByLabel("Número").fill("1");
      await page.getByLabel("Bairro").fill("Sé");
      await page.getByLabel("Cidade").fill("São Paulo");
      await page.getByLabel("UF").selectOption("SP");
      await page.getByRole("button", { name: "Salvar endereço" }).click();
      await expect(page.getByText("Entregar em").filter({ visible: true }).first()).toBeVisible();
    }
    await page.getByRole("button", { name: "Finalizar compra" }).click();
    await expect(page).toHaveURL(/\/conta\/pedidos\/[0-9a-f-]{36}\?novo=1/);
    orderId = new URL(page.url()).pathname.split("/").pop()!;
    const { data: o } = await buyer.c.from("orders").select("number").eq("id", orderId).single();
    orderNumber = o!.number;
    await ctx.close();

    const aff = await browserAs(browser, AFFILIATE, "/conta/indicacoes");
    const row = aff.getByRole("row", { name: new RegExp(`#${orderNumber}`) });
    await expect(row).toContainText("Aguardando pagamento");
    await expect(row).toContainText("R$ 100,00");
    await expect(row).toContainText("R$ 3,00");
    await aff.context().close();
  });

  test("pagamento confirma a comissão e o reembolso cancela", async ({ browser, request }) => {
    const { data: start, error } = await buyer.c.rpc("start_order_payment", { _order_id: orderId });
    if (error || !start) throw new Error(`pagamento: ${error?.message} (a loja de teste precisa da conta ativada pelo pay.spec)`);
    const { payment_id: paymentId, destination } = start as { payment_id: string; destination: string };
    // Cobrança direta: os avisos vêm da conta da loja (campo "account")
    const paid = sign({
      id: `evt_e2e_aff_paid_${run}`,
      object: "event",
      type: "checkout.session.completed",
      livemode: false,
      account: destination,
      data: {
        object: {
          id: `cs_test_aff${run}`,
          client_reference_id: paymentId,
          metadata: { payment_id: paymentId },
          amount_total: 10000,
          currency: "brl",
          payment_status: "paid",
          payment_intent: `pi_e2e_aff_${run}`,
        },
      },
    });
    const res = await request.post("/api/webhooks/stripe", { data: paid.payload, headers: { "stripe-signature": paid.signature } });
    expect((await res.json()).result).toBe("paid");

    const aff = await browserAs(browser, AFFILIATE, "/conta/indicacoes");
    await expect(aff.getByRole("row", { name: new RegExp(`#${orderNumber}`) })).toContainText("Confirmada");

    const refund = sign({
      id: `evt_e2e_aff_ref_${run}`,
      object: "event",
      type: "charge.refunded",
      livemode: false,
      account: destination,
      data: { object: { payment_intent: `pi_e2e_aff_${run}`, refunded: true } },
    });
    await request.post("/api/webhooks/stripe", { data: refund.payload, headers: { "stripe-signature": refund.signature } });
    await aff.reload();
    await expect(aff.getByRole("row", { name: new RegExp(`#${orderNumber}`) })).toContainText("Cancelada");
    await aff.context().close();
  });
});
