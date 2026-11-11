/**
 * Vídeos de ponta a ponta: vendedor publica (arquivo vai direto ao Storage) → feed toca o vídeo →
 * visitante precisa entrar para curtir → compradora curte e compra pelo vídeo → vendedor tira do ar.
 */
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://elygbieuroidqxkifgou.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_q6ee6uIuN9A8l8ni8wfngQ_NZc5L7Vn";
const PASSWORD = "Teste12345";
const SELLER = "e2e-vendedor@livelance.test";
const BUYER = process.env.E2E_EMAIL ?? "e2e@livelance.test";
const VIDEO = path.join(__dirname, "fixtures", "video.webm");
const NOT_VIDEO = path.join(__dirname, "fixtures", "produto.jpg");

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

test.describe("Vídeos: do envio à compra", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "roda uma vez (desktop)"));

  const run = Date.now();
  const title = `Relógio Vídeo ${run}`;
  let seller: { c: SupabaseClient<Database>; id: string };
  let buyer: { c: SupabaseClient<Database>; id: string };
  let productId = "";
  let videoSrc = "";

  test.beforeAll(async () => {
    seller = await signIn(SELLER);
    buyer = await signIn(BUYER);
    const { data: store } = await seller.c.from("stores").select("id").eq("owner_id", seller.id).single();
    const { data: p, error } = await seller.c
      .from("products")
      .insert({ store_id: store!.id, title, price_cents: 25000, stock: 3, status: "active" })
      .select("id")
      .single();
    if (error) throw error;
    productId = p.id;
    await buyer.c.from("cart_items").delete().eq("user_id", buyer.id);
  });

  test.afterAll(async () => {
    await buyer.c.from("cart_items").delete().eq("user_id", buyer.id);
    if (productId) await seller.c.from("products").update({ status: "paused" }).eq("id", productId);
  });

  test("vendedor publica o vídeo com o produto marcado", async ({ browser }) => {
    const page = await browserAs(browser, SELLER, "/seller/videos/novo");
    await expect(page.getByRole("heading", { name: "Publicar vídeo" })).toBeVisible();
    await page.getByLabel("Produto marcado").selectOption({ label: title });
    await page.getByLabel("Arquivo do vídeo").setInputFiles(NOT_VIDEO);
    await page.getByRole("button", { name: "Publicar vídeo" }).click();
    await expect(page.getByText("Envie um vídeo MP4, WebM ou MOV.")).toBeVisible();

    await page.getByLabel("Legenda (opcional)").fill("Olha o brilho desse relógio!");
    await page.getByLabel("Arquivo do vídeo").setInputFiles(VIDEO);
    await page.getByRole("button", { name: "Publicar vídeo" }).click();
    await expect(page).toHaveURL(/\/seller\/videos\?novo=1$/);
    await expect(page.getByText("Vídeo publicado!")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: title })).toBeVisible();
    await page.context().close();
  });

  test("visitante vê o vídeo tocando e precisa entrar para curtir", async ({ page }) => {
    await page.goto("/videos");
    const item = page.getByRole("article", { name: new RegExp(title) });
    await expect(item).toBeVisible();
    await expect(item.getByText("Olha o brilho desse relógio!")).toBeVisible();
    await expect(item.getByText("R$ 250,00")).toBeVisible();
    const video = item.locator("video");
    videoSrc = (await video.getAttribute("src"))!;
    expect(videoSrc).toContain("/product-videos/");
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(item.getByRole("link", { name: "Entrar para curtir" })).toBeVisible();
  });

  test("compradora curte e compra pelo vídeo", async ({ browser }) => {
    const page = await browserAs(browser, BUYER, "/videos");
    const item = page.getByRole("article", { name: new RegExp(title) });
    await item.getByRole("button", { name: "Curtir" }).click();
    await expect(item.getByRole("button", { name: "Descurtir" })).toHaveAttribute("aria-pressed", "true");
    await expect(item.getByTestId("curtidas")).toHaveText("1");
    await page.reload();
    await expect(page.getByRole("article", { name: new RegExp(title) }).getByRole("button", { name: "Descurtir" })).toBeVisible();

    await page.getByRole("article", { name: new RegExp(title) }).getByRole("button", { name: "Comprar agora" }).click();
    await expect(page).toHaveURL(/\/carrinho$/);
    await expect(page.getByText(title).filter({ visible: true }).first()).toBeVisible();
    await page.context().close();
  });

  test("vendedor tira o vídeo do ar e o arquivo é apagado", async ({ browser }) => {
    const page = await browserAs(browser, SELLER, "/seller/videos");
    const card = page.getByRole("listitem").filter({ hasText: title });
    await card.getByRole("button", { name: "Tirar do ar" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: title })).toHaveCount(0);
    await page.context().close();

    const anon = await browser.newContext({ ...test.info().project.use });
    const feed = await anon.newPage();
    await feed.goto("/videos");
    await expect(feed.getByRole("article", { name: new RegExp(title) })).toHaveCount(0);
    await anon.close();
    // O link público pode ficar em cache na CDN por um tempo; quem confirma a exclusão é o Storage
    const [folder, file] = videoSrc.split("/product-videos/")[1].split("/");
    const { data: files } = await seller.c.storage.from("product-videos").list(folder, { search: file });
    expect(files ?? []).toHaveLength(0);
  });
});
