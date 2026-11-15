import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";
import { runTag } from "./run-tag";

/** Perguntas e respostas: comprador pergunta (contato fora da Zexi é ocultado com aviso), a loja responde e todos veem. */
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://elygbieuroidqxkifgou.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_q6ee6uIuN9A8l8ni8wfngQ_NZc5L7Vn";
const PASSWORD = "Teste12345";
const SELLER = "e2e-vendedor@livelance.test";
const BUYER = process.env.E2E_EMAIL ?? "e2e@livelance.test";
const run = runTag();
const tag = run.toLowerCase();
const title = `Capacete Perguntas ${run}`;

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

test.describe("Perguntas e respostas", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "roda uma vez (desktop)"));

  let seller: SupabaseClient<Database>;
  let productId = "";

  test.beforeAll(async () => {
    seller = createClient<Database>(URL_SB, KEY, { auth: { persistSession: false } });
    const { data } = await seller.auth.signInWithPassword({ email: SELLER, password: PASSWORD });
    const { data: store } = await seller.from("stores").select("id").eq("owner_id", data.user!.id).single();
    const { data: p, error } = await seller
      .from("products")
      .insert({ store_id: store!.id, title, price_cents: 25000, stock: 3, status: "active" })
      .select("id")
      .single();
    if (error) throw error;
    productId = p.id;
  });

  test.afterAll(async () => {
    if (productId) await seller.from("products").update({ status: "paused" }).eq("id", productId);
  });

  test("visitante vê a seção e é convidado a entrar", async ({ page }) => {
    await page.goto(`/produto/${productId}`);
    const section = page.getByRole("region", { name: "Perguntas e respostas" });
    await expect(section).toContainText("Ninguém perguntou ainda");
    await expect(section.getByRole("link", { name: "Entre na sua conta" })).toBeVisible();
  });

  test("comprador pergunta; telefone é ocultado com aviso; a pergunta fica visível só para ele até a resposta", async ({ browser }) => {
    const buyer = await browserAs(browser, BUYER, `/produto/${productId}`);
    const section = buyer.getByRole("region", { name: "Perguntas e respostas" });
    await section.getByLabel("Pergunte ao vendedor").fill(`Tem desconto ${tag}? liga (62) 99999-8888 ou no whatsapp`);
    await section.getByRole("button", { name: "Perguntar" }).click();
    await expect(section.getByTestId("aviso-contato")).toContainText("proibido compartilhar telefone");
    const masked = section.getByTestId("lista-perguntas");
    await expect(masked).toContainText(`Tem desconto ${tag}? liga [contato oculto] ou no [contato oculto]`);
    await expect(masked).not.toContainText("99999");

    await section.getByLabel("Pergunte ao vendedor").fill(`Serve na cabeça 58? ${tag}`);
    await section.getByRole("button", { name: "Perguntar" }).click();
    await expect(section.getByRole("status")).toContainText("Pergunta enviada");
    await expect(section.getByTestId("lista-perguntas")).toContainText(`Serve na cabeça 58? ${tag}`);
    await expect(section.getByTestId("lista-perguntas")).toContainText("aguardando a resposta da loja");
    await buyer.context().close();
  });

  test("loja responde pelo painel e a resposta aparece para todos", async ({ browser, page }) => {
    const studio = await browserAs(browser, SELLER, "/seller/perguntas");
    const card = studio.getByTestId("pergunta-loja").filter({ hasText: `Serve na cabeça 58? ${tag}` });
    await card.getByLabel("Resposta").fill("Serve sim! O 58 é o tamanho M.");
    await card.getByRole("button", { name: "Responder" }).click();
    // Respondida, a pergunta passa para a lista de respondidas, com a resposta preenchida
    const answered = studio.getByRole("region", { name: "Respondidas" }).getByTestId("pergunta-loja").filter({ hasText: tag });
    await expect(answered.getByLabel("Resposta")).toHaveValue("Serve sim! O 58 é o tamanho M.");
    await studio.context().close();

    await page.goto(`/produto/${productId}`);
    const list = page.getByTestId("lista-perguntas");
    await expect(list).toContainText(`Serve na cabeça 58? ${tag}`);
    await expect(list).toContainText("Serve sim! O 58 é o tamanho M.");
  });
});

test.describe("Avaliações e reputação", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "roda uma vez (desktop)"));

  test("produto sem avaliações mostra o convite e a loja mostra a reputação", async ({ page }) => {
    await page.goto("/market");
    await page.getByRole("article").first().getByRole("link").first().click();
    await expect(page).toHaveURL(/\/produto\/[0-9a-f-]{36}/);
    const reviews = page.getByRole("region", { name: "Opiniões do produto" });
    await expect(reviews).toBeVisible();
    await expect(page.getByTestId("reputacao-loja").first()).toContainText(/Loja nova|Reputação (verde|amarela|vermelha)/);
    await page.getByRole("link", { name: "Ver mais da loja" }).click();
    await expect(page).toHaveURL(/\/loja\//);
    await expect(page.getByTestId("reputacao-loja")).toContainText(/vendas|Ainda sem vendas/);
  });

  test("vendedor vê a cor da reputação (ou loja nova) e as regras no painel", async ({ browser }) => {
    const studio = await browserAs(browser, SELLER, "/seller");
    const box = studio.getByRole("region", { name: "Sua reputação" });
    await expect(box.getByTestId("reputacao-loja")).toHaveAttribute("data-cor", /^(nova|green|yellow|red)$/);
    await expect(box).toContainText("5 primeiras vendas");
    await expect(box).toContainText("10%");
    await expect(box).toContainText("48 horas");
    await studio.context().close();
  });
});
