import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Pagamento dentro da Zexi (Payment Element da Stripe embutido, sem ir para a página da Stripe).
 * Só roda com chaves de TESTE da Stripe no ambiente (cartão de teste 4242, nenhum dinheiro real).
 */
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://elygbieuroidqxkifgou.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_q6ee6uIuN9A8l8ni8wfngQ_NZc5L7Vn";
const PASSWORD = "Teste12345";
const SELLER = "e2e-vendedor@livelance.test";
const BUYER = process.env.E2E_EMAIL ?? "e2e@livelance.test";
const stripeTest = /^pk_test_/.test(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "") && /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY ?? "");

test.describe("Pagamento dentro da Zexi", () => {
  test.skip(!stripeTest, "precisa das chaves de teste da Stripe (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY e STRIPE_SECRET_KEY)");
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "roda uma vez (desktop)"));

  test("finalizar o pedido abre o pagamento na Zexi e o cartão de teste conclui", async ({ page }) => {
    test.setTimeout(120_000);
    const seller = createClient<Database>(URL_SB, KEY, { auth: { persistSession: false } });
    const { data: auth } = await seller.auth.signInWithPassword({ email: SELLER, password: PASSWORD });
    const { data: store } = await seller.from("stores").select("id").eq("owner_id", auth.user!.id).single();
    const title = `Caneca Pagamento ${Date.now()}`;
    const { data: product, error } = await seller
      .from("products")
      .insert({ store_id: store!.id, title, price_cents: 3990, stock: 3, status: "active" })
      .select("id")
      .single();
    if (error) throw error;

    try {
      await page.goto(`/entrar?next=${encodeURIComponent(`/produto/${product.id}`)}`);
      await page.getByLabel("E-mail").fill(BUYER);
      await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await page.waitForURL((u) => u.pathname === `/produto/${product.id}`);
      // Carrinho só com este produto
      for (let i = 0; i < 10; i++) {
        await page.goto("/carrinho");
        const empty = page.getByRole("heading", { name: "Seu carrinho está vazio" });
        await expect(empty.or(page.getByRole("heading", { name: "Resumo" }))).toBeVisible();
        if (await empty.isVisible()) break;
        await page.getByRole("button", { name: /^Remover / }).filter({ visible: true }).first().click();
        await page.waitForTimeout(400);
      }
      await page.goto(`/produto/${product.id}`);
      await page.getByRole("button", { name: "Comprar agora" }).first().click();
      await expect(page).toHaveURL(/\/(carrinho|checkout)$/);
      if (!page.url().endsWith("/checkout")) await page.getByRole("link", { name: "Finalizar compra" }).click();
      await expect(page.getByRole("heading", { name: "Resumo da compra" })).toBeVisible();
      await page.getByRole("button", { name: "Finalizar compra" }).click();

      // Página de pagamento da Zexi (não a da Stripe)
      await expect(page).toHaveURL(/\/pagamento\?pedidos=/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Pagamento" })).toBeVisible();
      await expect(page.getByTestId("pay-teste").first()).toBeVisible();
      const frame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
      await expect(frame.getByText(/Cartão|Card/).first()).toBeVisible({ timeout: 30_000 });
      await frame.getByText(/Cartão|Card/).first().click();
      await frame.getByPlaceholder(/1234 1234 1234 1234/).fill("4242424242424242");
      await frame.getByPlaceholder(/MM \/ AA|MM \/ YY/).fill("12 / 34");
      await frame.getByPlaceholder(/CVC/).fill("123");
      // Navegador de teste fica nos EUA: escolhe Brasil como faria o comprador (sem CEP americano)
      await frame.getByLabel(/País|Country/).selectOption("BR");
      await page.getByRole("button", { name: /^Pagar R\$/ }).click();

      // Volta para o pedido; a confirmação vem pela Stripe (aviso ou conferência da sessão no retorno)
      await expect(page).toHaveURL(/\/conta\/pedidos\/[0-9a-f-]{36}.*pagamento=retorno/, { timeout: 60_000 });
      expect(page.url()).not.toContain("checkout.stripe.com");
    } finally {
      await seller.from("products").update({ status: "paused" }).eq("id", product.id);
    }
  });
});
