/**
 * LIVELANCE LIVE de ponta a ponta: loja programa a live → aparece em "Próximas" → começa →
 * destaca produto → chat em tempo real com moderação → leilão relâmpago aparece para quem assiste → encerra.
 * O vídeo em si depende do serviço de transmissão; aqui o player mostra os estados.
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

test.describe("LIVELANCE LIVE: da programação ao leilão relâmpago", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "roda uma vez (desktop)"));

  const run = Date.now();
  const liveTitle = `Live E2E ${run}`;
  const bag = `Bolsa Live ${run}`;
  const wallet = `Carteira Live ${run}`;
  let seller: { c: SupabaseClient<Database>; id: string };
  const productIds: string[] = [];
  let livePath = "";
  let studio: Page;
  let viewer: Page;

  test.beforeAll(async () => {
    seller = await signIn(SELLER);
    const { data: store } = await seller.c.from("stores").select("id").eq("owner_id", seller.id).single();
    for (const [title, price] of [[bag, 20000], [wallet, 8000]] as const) {
      const { data, error } = await seller.c
        .from("products")
        .insert({ store_id: store!.id, title, price_cents: price, stock: 2, status: "active" })
        .select("id")
        .single();
      if (error) throw error;
      productIds.push(data.id);
    }
  });

  test.afterAll(async () => {
    // Não deixa live "no ar" sobrando se algum passo falhar
    const liveId = livePath.split("/").pop();
    if (liveId) await seller.c.rpc("end_live", { _live_id: liveId });
    await studio?.context().close();
    await viewer?.context().close();
    if (productIds.length) await seller.c.from("products").update({ status: "paused" }).in("id", productIds);
  });

  test("loja programa a live e ela aparece nas próximas", async ({ browser, page }) => {
    studio = await browserAs(browser, SELLER, "/seller/lives/nova");
    await studio.getByLabel("Título").fill(liveTitle);
    await studio.getByLabel(bag).check();
    await studio.getByLabel(wallet).check();
    await studio.getByRole("button", { name: "Programar live" }).click();
    await expect(studio).toHaveURL(/\/seller\/lives\/[0-9a-f-]{36}\?nova=1$/);
    await expect(studio.getByTestId("estado-live")).toHaveText("Programada");
    livePath = `/live/${new URL(studio.url()).pathname.split("/").pop()}`;

    await page.goto("/ao-vivo");
    await expect(page.getByRole("heading", { name: "Próximas lives" })).toBeVisible();
    await page.getByRole("link", { name: new RegExp(liveTitle) }).click();
    await expect(page.getByTestId("live-player-status")).toHaveText("A transmissão ainda não começou.");
    await expect(page.getByText("O chat abre quando a live estiver no ar.")).toBeVisible();
  });

  test("começa, destaca produto e recebe o link do vídeo", async () => {
    await studio.getByRole("button", { name: "Começar live" }).click();
    await expect(studio.getByTestId("estado-live")).toHaveText("Ao vivo");
    await studio.getByRole("button", { name: `Destacar ${bag}` }).click();
    await expect(studio.getByText("Em destaque")).toBeVisible();

    // Sem o token do Mux no ambiente de teste: transmissão integrada "em configuração", link HLS manual
    await expect(studio.getByTestId("transmissao")).toContainText("em configuração");
    await expect(studio.getByTestId("transmissao")).not.toContainText("rtmps://");
    await studio.getByLabel("Link de reprodução HLS").fill("http://inseguro.com/live.m3u8");
    await studio.getByRole("button", { name: "Salvar" }).click();
    await expect(studio.getByRole("alert").filter({ hasText: "link HLS" })).toBeVisible();
    await studio.getByLabel("Link de reprodução HLS").fill("https://stream.livelance.test/e2e/live.m3u8");
    await studio.getByRole("button", { name: "Salvar" }).click();
    await expect(studio.getByLabel("Link de reprodução HLS")).toHaveValue("https://stream.livelance.test/e2e/live.m3u8");
  });

  test("público vê o destaque e conversa no chat; a loja modera em tempo real", async ({ browser }) => {
    viewer = await browserAs(browser, BUYER, livePath);
    const highlight = viewer.getByRole("region", { name: "Produto em destaque" });
    await expect(highlight).toContainText(bag);
    await expect(highlight.getByRole("button", { name: "Comprar agora" })).toBeVisible();
    await expect(viewer.getByText("AO VIVO", { exact: true })).toBeVisible();

    // Espera os dois chats conectarem ao tempo real antes de conversar
    await expect(viewer.getByRole("region", { name: "Chat da live" })).toHaveAttribute("data-realtime", "on");
    await expect(studio.getByRole("region", { name: "Chat da live" })).toHaveAttribute("data-realtime", "on");
    const text = `Tem em azul? ${run}`;
    await viewer.getByLabel("Mensagem para o chat").fill(text);
    await viewer.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(viewer.getByTestId("chat-mensagens")).toContainText(text);
    await expect(studio.getByTestId("chat-mensagens")).toContainText(text);

    await studio.getByTestId("chat-mensagens").getByRole("button", { name: "Esconder" }).last().click();
    await expect(viewer.getByTestId("chat-mensagens")).not.toContainText(text);
  });

  test("leilão relâmpago aparece para quem está assistindo", async () => {
    const item = studio.getByRole("listitem").filter({ hasText: wallet });
    await item.getByText("Leilão relâmpago").click();
    await item.getByLabel(`Lance inicial de ${wallet}`).fill("50,00");
    await item.getByLabel(`Incremento de ${wallet}`).fill("5,00");
    await item.getByRole("button", { name: "Abrir leilão" }).click();
    await expect(studio.getByText("Leilão relâmpago em andamento")).toBeVisible();

    const box = viewer.getByRole("region", { name: "Leilão relâmpago" });
    await expect(box).toContainText(wallet, { timeout: 15_000 });
    await expect(viewer.getByTestId("leilao-live-preco")).toHaveText("R$ 50,00");
    await expect(box.getByRole("link", { name: "Dar lance" })).toHaveAttribute("href", /\/leilao\/[0-9a-f-]{36}$/);
  });

  test("loja encerra e a sala fecha para o público", async () => {
    await studio.getByRole("button", { name: "Encerrar live" }).click();
    await expect(studio.getByTestId("estado-live")).toHaveText("Encerrada");
    await expect(viewer.getByTestId("live-player-status")).toHaveText("Esta live terminou.", { timeout: 15_000 });
    await expect(viewer.getByText("O chat abre quando a live estiver no ar.")).toBeVisible();
  });
});
