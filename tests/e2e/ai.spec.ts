/**
 * IA sem chave (ambiente de teste): tudo continua funcionando e a IA aparece como "em configuração".
 * Os filtros que a busca inteligente usa (preço e condição) funcionam também pela URL.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://elygbieuroidqxkifgou.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_q6ee6uIuN9A8l8ni8wfngQ_NZc5L7Vn";

test.describe("IA e filtros do Market", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "roda uma vez (desktop)"));

  const run = Date.now();
  const word = `Garrafa${run}`;
  let seller: SupabaseClient<Database>;
  const ids: string[] = [];

  test.beforeAll(async () => {
    seller = createClient<Database>(URL_SB, KEY, { auth: { persistSession: false } });
    const { data } = await seller.auth.signInWithPassword({ email: "e2e-vendedor@livelance.test", password: "Teste12345" });
    const { data: store } = await seller.from("stores").select("id").eq("owner_id", data.user!.id).single();
    for (const [title, price, condition] of [
      [`${word} térmica barata`, 9000, "used"],
      [`${word} térmica premium`, 45000, "new"],
    ] as const) {
      const { data: p, error } = await seller
        .from("products")
        .insert({ store_id: store!.id, title, price_cents: price, stock: 1, status: "active", condition })
        .select("id")
        .single();
      if (error) throw error;
      ids.push(p.id);
    }
  });

  test.afterAll(async () => {
    if (ids.length) await seller.from("products").update({ status: "paused" }).in("id", ids);
  });

  test("filtros de preço e condição pela URL", async ({ page }) => {
    await page.goto(`/market?q=${word}`);
    await expect(page.getByText("2 produtos")).toBeVisible();

    await page.goto(`/market?q=${word}&preco_max=100`);
    await expect(page.getByText("1 produto", { exact: true })).toBeVisible();
    await expect(page.getByText(`${word} térmica barata`).first()).toBeVisible();
    await expect(page.getByTestId("filtros-aplicados")).toContainText("até R$ 100");

    await page.goto(`/market?q=${word}&condicao=new`);
    await expect(page.getByText(`${word} térmica premium`).first()).toBeVisible();
    await expect(page.getByText(`${word} térmica barata`)).toHaveCount(0);

    await page.getByRole("link", { name: "Limpar filtros" }).click();
    await expect(page.getByText("2 produtos")).toBeVisible();
  });

  test("sem chave da IA: busca inteligente escondida e aviso no cadastro", async ({ page }) => {
    await page.goto("/market");
    await expect(page.getByRole("button", { name: "Buscar com IA" })).toHaveCount(0);

    await page.goto(`/entrar?next=${encodeURIComponent(`/seller/produtos/${ids[0]}`)}`);
    await page.getByLabel("E-mail").fill("e2e-vendedor@livelance.test");
    await page.getByLabel("Senha", { exact: true }).fill("Teste12345");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByText("Descrição com IA: em configuração.")).toBeVisible();
  });
});
