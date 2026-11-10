import { expect, test, type Browser, type Page } from "@playwright/test";

const SELLER = { email: "e2e-vendedor@livelance.test", cpf: "" };
const ANA = { email: process.env.E2E_EMAIL ?? "e2e@livelance.test", cpf: "529.982.247-25" };
const BRUNO = { email: "e2e-comprador2@livelance.test", cpf: "111.444.777-35" };
const PASSWORD = "Teste12345";

async function newSession(browser: Browser, email: string, next: string): Promise<Page> {
  const ctx = await browser.newContext({ ...test.info().project.use, locale: "pt-BR" });
  const page = await ctx.newPage();
  await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
  return page;
}

/** Garante a verificação (CPF + celular) e volta para o leilão. */
async function ensureVerified(page: Page, cpf: string, auctionUrl: string) {
  const cta = page.getByRole("link", { name: "Confirmar CPF e telefone" });
  const form = page.getByLabel(/Seu lance/);
  await expect(cta.or(form)).toBeVisible();
  if (await cta.isVisible()) {
    await cta.click();
    await page.getByLabel("CPF").fill(cpf);
    await page.getByLabel("Celular com DDD").fill("(11) 98888-7777");
    await page.getByRole("button", { name: "Confirmar dados" }).click();
    await expect(page).toHaveURL(new RegExp(auctionUrl.replace(/[/?]/g, "\\$&") + "$"));
  }
}

test.describe("LIVELANCE LEILÕES: disputa em tempo real", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "roda uma vez (desktop)"));

  const title = `Relógio E2E ${Date.now()}`;
  let auctionPath = "";

  test("vendedor cadastra o lote e abre o leilão", async ({ browser }) => {
    const page = await newSession(browser, SELLER.email, "/seller/produtos/novo");
    await page.getByLabel("Título").fill(title);
    await page.getByLabel("Categoria").selectOption({ label: "Colecionáveis" });
    await page.getByLabel("Preço (R$)").fill("300,00");
    await page.getByLabel("Estoque").fill("1");
    await page.getByLabel("Situação").selectOption("active");
    await page.getByRole("button", { name: "Criar produto" }).click();
    await expect(page).toHaveURL(/\/seller\/produtos\/[0-9a-f-]{36}/);
    const productId = new URL(page.url()).pathname.split("/").pop()!;

    await page.goto("/seller/leiloes/novo");
    await page.getByLabel("Produto (lote)").selectOption(productId);
    await page.getByLabel("Lance inicial (R$)").fill("100,00");
    await page.getByLabel("Incremento mínimo (R$)").fill("10,00");
    // reserva alta: o leilão de teste termina sem vencedor (não gera inadimplência)
    await page.getByLabel("Reserva (opcional)").fill("99999,00");
    await page.getByLabel("Duração").selectOption("60");
    await page.getByRole("button", { name: "Abrir leilão" }).click();
    await expect(page).toHaveURL(/\/leilao\/[0-9a-f-]{36}\?criado=1$/);
    auctionPath = new URL(page.url()).pathname;
    await expect(page.getByText("Este leilão é da sua loja").filter({ visible: true }).first()).toBeVisible();
    await page.context().close();
  });

  test("Ana dá lance, Bruno cobre e a tela da Ana atualiza sozinha", async ({ browser }) => {
    const ana = await newSession(browser, ANA.email, auctionPath);
    await ensureVerified(ana, ANA.cpf, auctionPath);

    // lance abaixo do mínimo é recusado pelo servidor
    await ana.getByLabel(/Seu lance/).fill("50,00");
    await ana.getByRole("button", { name: /Dar lance/ }).click();
    await expect(ana.locator("main [role=alert]")).toContainText("O lance mínimo agora é R$ 100,00");

    await ana.getByLabel(/Seu lance/).fill("");
    await ana.getByRole("button", { name: /Dar lance · R\$ 100,00/ }).click();
    await expect(ana.getByText("Você tem o maior lance").filter({ visible: true }).first()).toBeVisible();
    await expect(ana.getByTestId("maior-lance")).toHaveText(/R\$\s100,00/);

    const bruno = await newSession(browser, BRUNO.email, auctionPath);
    await ensureVerified(bruno, BRUNO.cpf, auctionPath);
    await expect(bruno.getByTestId("maior-lance")).toHaveText(/R\$\s100,00/);
    await bruno.getByRole("button", { name: /Dar lance · R\$ 110,00/ }).click();
    await expect(bruno.getByText("Você tem o maior lance").filter({ visible: true }).first()).toBeVisible();

    // tempo real: sem recarregar, a Ana vê o novo maior lance e volta a poder dar lance
    await expect(ana.getByTestId("maior-lance")).toHaveText(/R\$\s110,00/, { timeout: 15_000 });
    await expect(ana.getByRole("button", { name: /Dar lance · R\$ 120,00/ })).toBeVisible();
    await expect(ana.getByRole("list", { name: /Lances/ }).getByText("R$ 110,00")).toBeVisible();

    await ana.goto("/conta/lances");
    await expect(ana.getByText(title).filter({ visible: true }).first()).toBeVisible();
    await expect(ana.getByText("Seu lance foi superado").filter({ visible: true }).first()).toBeVisible();

    await ana.context().close();
    await bruno.context().close();
  });

  test("visitante vê o leilão na lista e não consegue dar lance sem entrar", async ({ page }) => {
    await page.goto("/leiloes");
    await page.getByRole("link", { name: title }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("link", { name: "Entrar" }).last()).toBeVisible();
    await expect(page.getByText("Histórico de lances")).toBeVisible();
  });
});
