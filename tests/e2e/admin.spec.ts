/**
 * Admin de ponta a ponta: compradora denuncia um anúncio → área do admin não existe para ela →
 * equipe vê a denúncia, bloqueia o produto (some do site, a loja não reativa) → desbloqueia →
 * suspende e reativa a loja.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://elygbieuroidqxkifgou.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_q6ee6uIuN9A8l8ni8wfngQ_NZc5L7Vn";
const PASSWORD = "Teste12345";
const SELLER = "e2e-vendedor@livelance.test";
const BUYER = process.env.E2E_EMAIL ?? "e2e@livelance.test";
const ADMIN = "e2e-admin@livelance.test";

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

test.describe("Admin: denúncia, moderação e lojas", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "roda uma vez (desktop)"));

  const run = Date.now();
  const title = `Tênis Suspeito ${run}`;
  const details = `Parece réplica ${run}`;
  let seller: { c: SupabaseClient<Database>; id: string };
  let admin: { c: SupabaseClient<Database>; id: string };
  let productId = "";
  let store = { id: "", slug: "" };

  test.beforeAll(async () => {
    seller = await signIn(SELLER);
    admin = await signIn(ADMIN);
    const { data: s } = await seller.c.from("stores").select("id, slug").eq("owner_id", seller.id).single();
    store = s!;
    const { data, error } = await seller.c
      .from("products")
      .insert({ store_id: store.id, title, price_cents: 15000, stock: 1, status: "active" })
      .select("id")
      .single();
    if (error) throw error;
    productId = data.id;
  });

  test.afterAll(async () => {
    // Nunca deixa a loja de teste suspensa nem o produto bloqueado/ativo
    await admin.c.rpc("admin_set_store_active", { _store_id: store.id, _active: true, _reason: "limpeza do teste" });
    await admin.c.rpc("admin_unblock_product", { _product_id: productId });
    await seller.c.from("products").update({ status: "paused" }).eq("id", productId);
  });

  test("compradora denuncia o anúncio e não enxerga o admin", async ({ browser }) => {
    const page = await browserAs(browser, BUYER, `/produto/${productId}`);
    await page.getByRole("link", { name: "Denunciar este anúncio" }).click();
    await expect(page.getByRole("heading", { name: "Denunciar" })).toBeVisible();
    await page.getByLabel("Produto falsificado").check();
    await page.getByLabel("Detalhes (opcional)").fill(details);
    await page.getByRole("button", { name: "Enviar denúncia" }).click();
    await expect(page.getByText("Denúncia enviada.")).toBeVisible();

    await page.goto(`/denunciar?tipo=product&id=${productId}`);
    await page.getByLabel("Spam ou propaganda").check();
    await page.getByRole("button", { name: "Enviar denúncia" }).click();
    await expect(page.getByText("Você já denunciou este item.")).toBeVisible();

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Painel da equipe" })).toHaveCount(0);
    await page.context().close();
  });

  test("equipe bloqueia o produto pela denúncia", async ({ browser, page }) => {
    const adm = await browserAs(browser, ADMIN, "/admin");
    await expect(adm.getByRole("heading", { name: "Visão geral" })).toBeVisible();
    await expect(adm.getByTestId("card-Denúncias abertas")).not.toContainText(/^Denúncias abertas0$/);
    await adm.getByRole("navigation", { name: "Painel da equipe" }).getByRole("link", { name: "Denúncias" }).click();
    const report = adm.getByTestId("denuncia").filter({ hasText: details });
    await expect(report).toBeVisible();
    await report.getByRole("button", { name: "Bloquear produto" }).click();
    await expect(adm.getByText("Escreva o motivo")).toBeVisible();

    const again = adm.getByTestId("denuncia").filter({ hasText: details });
    await again.getByLabel("Motivo da decisão").fill("Réplica de marca");
    await again.getByRole("button", { name: "Bloquear produto" }).click();
    await expect(adm.getByText("Denúncia tratada.")).toBeVisible();
    await expect(adm.getByTestId("denuncia").filter({ hasText: details })).toHaveCount(0);

    await page.goto(`/produto/${productId}`);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    const { error } = await seller.c.from("products").update({ status: "active" }).eq("id", productId);
    expect(error?.message).toContain("product_blocked");

    await adm.goto("/admin/moderacao");
    const blocked = adm.getByRole("region", { name: "Produtos bloqueados" }).getByRole("listitem").filter({ hasText: title });
    await expect(blocked).toContainText("Réplica de marca");
    await blocked.getByRole("button", { name: "Desbloquear" }).click();
    await expect(adm.getByText("Feito.")).toBeVisible();
    await expect(adm.getByRole("region", { name: "Produtos bloqueados" }).getByText(title)).toHaveCount(0);
    await adm.context().close();
  });

  test("equipe suspende e reativa a loja", async ({ browser, page }) => {
    const adm = await browserAs(browser, ADMIN, "/admin/lojas");
    const row = adm.getByTestId("loja-admin").filter({ has: adm.getByRole("link", { name: "Loja E2E LIVELANCE" }) });
    await row.getByLabel("Motivo: Suspender loja").fill("Teste de suspensão");
    await row.getByRole("button", { name: "Suspender loja" }).click();
    await expect(adm.getByText("Feito.")).toBeVisible();
    await expect(row).toContainText("Suspensa");

    await page.goto(`/loja/${store.slug}`);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();

    await row.getByRole("button", { name: "Reativar loja" }).click();
    await expect(row).toContainText("Ativa");
    await page.goto(`/loja/${store.slug}`);
    await expect(page.getByRole("heading", { name: "Loja E2E LIVELANCE" })).toBeVisible();
    await adm.context().close();
  });
});
