/**
 * Frete por tabela de ponta a ponta: loja informa o CEP de origem → comprador vê PAC e SEDEX no checkout
 * → escolhe SEDEX → pedido sai com o frete no total. Ao final, o CEP da loja de teste volta ao que era.
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

test.describe("Frete: CEP da loja, PAC/SEDEX no checkout", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "roda uma vez (desktop)"));

  const title = `Tênis Frete ${Date.now()}`;
  let seller: { c: SupabaseClient<Database>; id: string };
  let buyer: { c: SupabaseClient<Database>; id: string };
  let storeId = "";
  let originalCep: string | null = null;
  let productId = "";
  let orderId = "";

  test.beforeAll(async () => {
    seller = await signIn(SELLER);
    buyer = await signIn(BUYER);
    const { data: store } = await seller.c.from("stores").select("id, origin_cep").eq("owner_id", seller.id).single();
    storeId = store!.id;
    originalCep = store!.origin_cep;
    const { data: p, error } = await seller.c
      .from("products")
      .insert({ store_id: storeId, title, price_cents: 20000, stock: 5, status: "active", weight_grams: 800 })
      .select("id")
      .single();
    if (error) throw error;
    productId = p.id;
    await buyer.c.from("cart_items").delete().eq("user_id", buyer.id);
  });

  test.afterAll(async () => {
    if (orderId) await buyer.c.rpc("cancel_order", { _order_id: orderId });
    if (productId) await seller.c.from("products").update({ status: "paused" }).eq("id", productId);
    if (storeId) await seller.c.from("stores").update({ origin_cep: originalCep }).eq("id", storeId);
  });

  test("loja informa o CEP de origem", async ({ browser }) => {
    const page = await browserAs(browser, SELLER, "/seller/loja");
    const cep = page.getByLabel(/CEP de origem/);
    await cep.fill("123");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("CEP inválido. Use 8 números")).toBeVisible();
    await page.getByLabel(/CEP de origem/).fill("01001-000");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Loja atualizada.")).toBeVisible();
    const { data } = await seller.c.from("stores").select("origin_cep").eq("id", storeId).single();
    expect(data!.origin_cep).toBe("01001000");
    await page.context().close();
  });

  test("comprador escolhe SEDEX e o pedido sai com frete", async ({ browser }) => {
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
    const frete = page.getByTestId("frete");
    await expect(frete.getByText("PAC", { exact: true })).toBeVisible();
    await expect(frete.getByText("SEDEX", { exact: true })).toBeVisible();
    const pacTotal = await page.getByTestId("total-com-frete").textContent();
    await frete.getByText("SEDEX", { exact: true }).click();
    await expect(page.getByTestId("total-com-frete")).not.toHaveText(pacTotal!);

    await page.getByRole("button", { name: "Finalizar compra" }).click();
    await expect(page).toHaveURL(/\/conta\/pedidos\/[0-9a-f-]{36}\?novo=1/);
    orderId = new URL(page.url()).pathname.split("/").pop()!;
    const { data: o } = await buyer.c
      .from("orders")
      .select("subtotal_cents, shipping_cents, shipping_service, total_cents")
      .eq("id", orderId)
      .single();
    expect(o!.shipping_service).toBe("sedex");
    expect(o!.shipping_cents).toBeGreaterThan(0);
    expect(o!.total_cents).toBe(o!.subtotal_cents + o!.shipping_cents);
    await expect(page.getByText(/Frete \(SEDEX, até \d+ dias? út/)).toBeVisible();
    await page.context().close();
  });
});
