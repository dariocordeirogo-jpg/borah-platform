import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

/** Página da loja personalizada: o vendedor muda cor, frase, logo, capa, banner e destaques; o cliente vê. */
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://elygbieuroidqxkifgou.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_q6ee6uIuN9A8l8ni8wfngQ_NZc5L7Vn";
const PASSWORD = "Teste12345";
const SELLER = "e2e-vendedor@livelance.test";
const fixture = (name: string) => path.join(__dirname, "fixtures", name);

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

test.describe("Página da loja personalizada", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "roda uma vez (desktop)"));

  let seller: SupabaseClient<Database>;
  let slug = "";
  let storeId = "";

  test.beforeAll(async () => {
    seller = createClient<Database>(URL_SB, KEY, { auth: { persistSession: false } });
    const { data } = await seller.auth.signInWithPassword({ email: SELLER, password: PASSWORD });
    const { data: store } = await seller.from("stores").select("id, slug").eq("owner_id", data.user!.id).single();
    slug = store!.slug;
    storeId = store!.id;
    // Começa limpo (banners e destaques de execuções anteriores)
    await seller.from("store_banners").delete().eq("store_id", storeId);
    await seller.from("store_featured").delete().eq("store_id", storeId);
  });

  test.afterAll(async () => {
    await seller.from("store_banners").delete().eq("store_id", storeId);
    await seller.from("store_featured").delete().eq("store_id", storeId);
    await seller.from("stores").update({ theme: "laranja", tagline: null, logo_path: null, cover_path: null }).eq("id", storeId);
  });

  test("vendedor personaliza e o cliente vê a página nova", async ({ browser, page }) => {
    const studio = await browserAs(browser, SELLER, "/seller/loja");
    const look = studio.getByRole("region", { name: "Aparência da loja" });
    await look.getByText("Azul", { exact: true }).click();
    await look.getByLabel(/Frase de apresentação/).fill("Peças originais, chama no whatsapp");
    await look.getByRole("button", { name: "Salvar aparência" }).click();
    await expect(studio.getByRole("status").filter({ hasText: "Aparência salva" })).toBeVisible();
    await expect(studio.getByTestId("aviso-contato")).toContainText("proibido");

    await studio.getByLabel("Arquivo do logo").setInputFiles(fixture("produto.jpg"));
    await studio.getByRole("button", { name: "Enviar logo" }).click();
    await expect(studio.getByRole("status").filter({ hasText: "Logo atualizado" })).toBeVisible();
    await studio.getByLabel("Arquivo da capa").setInputFiles(fixture("falso.png"));
    await studio.getByRole("button", { name: "Enviar capa" }).click();
    await expect(studio.getByRole("alert").filter({ hasText: "JPG, PNG ou WebP" })).toBeVisible();
    await studio.getByLabel("Arquivo da capa").setInputFiles(fixture("produto.jpg"));
    await studio.getByRole("button", { name: "Enviar capa" }).click();
    await expect(studio.getByRole("status").filter({ hasText: "Capa atualizada" })).toBeVisible();

    const banners = studio.getByRole("region", { name: "Banners da loja" });
    await banners.getByLabel("Imagem do banner").setInputFiles(fixture("produto.jpg"));
    await banners.getByLabel(/Título/).fill("Semana do cliente");
    await banners.getByRole("button", { name: "Publicar banner" }).click();
    await expect(studio.getByRole("status").filter({ hasText: "Banner publicado" })).toBeVisible();
    await expect(studio.getByTestId("banner-loja")).toHaveCount(1);

    const featured = studio.getByRole("region", { name: "Produtos em destaque" });
    const boxes = featured.getByRole("checkbox");
    if ((await boxes.count()) > 0) {
      await boxes.first().check();
      await featured.getByRole("button", { name: "Salvar destaques" }).click();
      await expect(studio.getByRole("status").filter({ hasText: "Destaques salvos" })).toBeVisible();
    }
    await studio.context().close();

    await page.goto(`/loja/${slug}`);
    const store = page.getByTestId("pagina-loja");
    await expect(store).toHaveAttribute("data-tema", "azul");
    await expect(store).toContainText("Peças originais, chama no [contato oculto]");
    await expect(store.getByRole("img", { name: /Logo da/ })).toBeVisible();
    await expect(page.getByTestId("banner-publico")).toContainText("Semana do cliente");
    await expect(store.getByRole("heading", { name: "Todos os produtos" })).toBeVisible();
  });
});
