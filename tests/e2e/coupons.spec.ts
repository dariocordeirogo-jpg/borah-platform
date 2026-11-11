/**
 * Cupons de ponta a ponta: loja cria o cupom → compradora aplica no checkout → pedido com desconto
 * → mesmo cupom não vale de novo → loja vê o uso.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://elygbieuroidqxkifgou.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_q6ee6uIuN9A8l8ni8wfngQ_NZc5L7Vn";
const PASSWORD = "Teste12345";
const SELLER = "e2e-vendedor@livelance.test";
const BUYER = process.env.E2E_EMAIL ?? "e2e@livelance.test";

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

test.describe("Cupons: loja cria, compradora usa", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "roda uma vez (desktop)"));

  const run = Date.now();
  const title = `Mochila Cupom ${run}`;
  const code = `E2E${String(run).slice(-8)}`;
  let seller: { c: SupabaseClient<Database>; id: string };
  let buyer: { c: SupabaseClient<Database>; id: string };
  let productId = "";
  let orderId = "";

  test.beforeAll(async () => {
    seller = await signIn(SELLER);
    buyer = await signIn(BUYER);
    const { data: store } = await seller.c.from("stores").select("id").eq("owner_id", seller.id).single();
    const { data: p, error } = await seller.c
      .from("products")
      .insert({ store_id: store!.id, title, price_cents: 10000, stock: 5, status: "active" })
      .select("id")
      .single();
    if (error) throw error;
    productId = p.id;
    await buyer.c.from("cart_items").delete().eq("user_id", buyer.id);
  });

  test.afterAll(async () => {
    if (orderId) await buyer.c.rpc("cancel_order", { _order_id: orderId });
    if (productId) await seller.c.from("products").update({ status: "paused" }).eq("id", productId);
    const { data: c } = await seller.c.from("coupons").select("id").eq("code", code).maybeSingle();
    if (c) await seller.c.rpc("set_coupon_active", { _coupon_id: c.id, _active: false });
  });

  test("loja cria o cupom pelo painel", async ({ browser }) => {
    const page = await browserAs(browser, SELLER, "/seller/cupons");
    await expect(page.getByRole("heading", { name: "Cupons" })).toBeVisible();
    await page.getByLabel("Código").fill("x!");
    await page.getByLabel("Desconto (%)").fill("10");
    await page.getByRole("button", { name: "Criar cupom" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "3 a 20 letras" })).toBeVisible();

    await page.getByLabel("Código").fill(code.toLowerCase());
    await page.getByLabel("Desconto (%)").fill("10");
    await page.getByRole("button", { name: "Criar cupom" }).click();
    await expect(page).toHaveURL(/\/seller\/cupons\?ok=1/);
    const row = page.getByTestId("cupom").filter({ hasText: code });
    await expect(row).toContainText("10% de desconto");
    await expect(row).toContainText("Ativo");
    await page.context().close();
  });

  test("compradora aplica o cupom e o pedido sai com desconto", async ({ browser }) => {
    await buyer.c.from("cart_items").insert({ user_id: buyer.id, product_id: productId, quantity: 1 });
    const page = await browserAs(browser, BUYER, "/checkout");
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
    const coupon = page.getByLabel(/Cupom de desconto/);
    await coupon.fill("NAOEXISTE1");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Cupom inválido" })).toBeVisible();

    await coupon.fill(code.toLowerCase());
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByTestId("cupom-ok")).toContainText("10,00 de desconto");

    await page.getByRole("button", { name: "Finalizar compra" }).click();
    await expect(page).toHaveURL(/\/conta\/pedidos\/[0-9a-f-]{36}\?novo=1/);
    orderId = new URL(page.url()).pathname.split("/").pop()!;
    await expect(page.getByTestId("desconto")).toContainText(`cupom ${code}`);
    await expect(page.getByTestId("desconto")).toContainText("10,00");
    const { data: o } = await buyer.c.from("orders").select("subtotal_cents, discount_cents, total_cents").eq("id", orderId).single();
    expect(o).toEqual({ subtotal_cents: 10000, discount_cents: 1000, total_cents: 9000 });
    await page.context().close();
  });

  test("o mesmo cupom não vale duas vezes", async ({ browser }) => {
    await buyer.c.from("cart_items").insert({ user_id: buyer.id, product_id: productId, quantity: 1 });
    const page = await browserAs(browser, BUYER, "/checkout");
    await page.getByLabel(/Cupom de desconto/).fill(code);
    await page.getByRole("button", { name: "Finalizar compra" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Você já usou este cupom." })).toBeVisible();
    await expect(page).toHaveURL(/\/checkout$/);
    await buyer.c.from("cart_items").delete().eq("user_id", buyer.id);
    await page.context().close();
  });

  test("loja vê o uso e o cupom no pedido", async ({ browser }) => {
    const page = await browserAs(browser, SELLER, "/seller/cupons");
    await expect(page.getByTestId("cupom").filter({ hasText: code })).toContainText("1 uso");
    await page.goto("/seller/pedidos");
    await expect(page.getByText(`cupom ${code}`).first()).toBeVisible();
    await page.context().close();
  });
});
