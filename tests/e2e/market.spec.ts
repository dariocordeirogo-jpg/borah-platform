import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Usuários de teste do projeto de desenvolvimento (e-mail confirmado). Não existem em produção.
const SELLER = { email: "e2e-vendedor@livelance.test", password: "Teste12345" };
const BUYER = { email: process.env.E2E_EMAIL ?? "e2e@livelance.test", password: process.env.E2E_PASSWORD ?? "Teste12345" };
const fixture = (f: string) => path.join(__dirname, "fixtures", f);

async function login(page: Page, who: { email: string; password: string }, next = "/conta") {
  await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-mail").fill(who.email);
  await page.getByLabel("Senha", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

async function logout(page: Page) {
  await page.goto("/conta");
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

test.describe("ZEXI MARKET: do anúncio ao pedido", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "fluxo completo roda uma vez (desktop)"));

  const title = `Fone E2E ${Date.now()}`;
  let productUrl = "";

  test("vendedor abre a loja (se ainda não tiver), cria produto e envia foto", async ({ page }) => {
    await login(page, SELLER, "/seller");
    const openStore = page.getByRole("button", { name: "Abrir minha loja" });
    const dashboard = page.getByRole("link", { name: "Novo produto" });
    await expect(openStore.or(dashboard)).toBeVisible();
    if (await openStore.isVisible()) {
      await page.getByLabel("Nome da loja").fill("Loja E2E LIVELANCE");
      await page.getByLabel(/Endereço/).fill(`loja-e2e-${Date.now().toString(36)}`);
      await page.getByRole("button", { name: "Abrir minha loja" }).click();
    }
    await expect(page).toHaveURL(/\/seller/);

    await page.goto("/seller/produtos/novo");
    await page.getByRole("button", { name: "Criar produto" }).click();
    await expect(page.getByText("O título precisa ter pelo menos 3 letras.").filter({ visible: true }).first()).toBeVisible();

    await page.getByLabel("Título").fill(title);
    await page.getByLabel("Categoria").selectOption({ label: "Eletrônicos" });
    await page.getByLabel("Preço (R$)").fill("123,45");
    await page.getByLabel("Estoque").fill("3");
    await page.getByLabel("Descrição").fill("Produto criado pelo teste automático.");
    await page.getByLabel("Situação").selectOption("active");
    await page.getByRole("button", { name: "Criar produto" }).click();
    await expect(page).toHaveURL(/\/seller\/produtos\/[0-9a-f-]{36}\?criado=1/);
    productUrl = page.url().replace(/\/seller\/produtos\//, "/produto/").replace(/\?.*$/, "");

    // arquivo falso com extensão .png é recusado pelo servidor
    await page.locator('input[name="images"]').setInputFiles(fixture("falso.png"));
    await page.getByRole("button", { name: "Enviar fotos" }).click();
    await expect(page.locator("main [role=alert]")).toContainText("não é JPG, PNG ou WebP");

    await page.locator('input[name="images"]').setInputFiles(fixture("produto.jpg"));
    await page.getByRole("button", { name: "Enviar fotos" }).click();
    await expect(page.locator("main [role=status]").last()).toContainText("Foto enviada");
    await expect(page.getByRole("heading", { name: /Fotos \(1\/8\)/ })).toBeVisible();
    await logout(page);
  });

  test("visitante encontra o produto na busca e vê a página", async ({ page }) => {
    await page.goto(`/busca?q=${encodeURIComponent(title)}`);
    await expect(page).toHaveURL(/\/market\?q=/);
    await page.getByRole("link", { name: title }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("R$ 123,45").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("3 disponíveis").filter({ visible: true }).first()).toBeVisible();
    const photo = page.getByRole("img", { name: title });
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
  });

  test("comprador compra 2 unidades, o estoque baixa, e cancela o pedido", async ({ page }) => {
    await login(page, BUYER);
    // começa com o carrinho vazio (sobras de execuções anteriores)
    for (let i = 0; i < 10; i++) {
      await page.goto("/carrinho");
      const empty = page.getByRole("heading", { name: "Seu carrinho está vazio" });
      await expect(empty.or(page.getByRole("heading", { name: "Resumo" }))).toBeVisible();
      if (await empty.isVisible()) break;
      await page.getByRole("button", { name: /^Remover / }).filter({ visible: true }).first().click();
      await page.waitForTimeout(400);
    }
    await page.goto(productUrl);
    await page.getByLabel("Quantidade").selectOption("2");
    await page.getByRole("button", { name: "Comprar agora" }).click();
    await expect(page).toHaveURL(/\/carrinho$/);
    await expect(page.getByText(title).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("R$ 246,90").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Carrinho, 2 itens/ })).toBeVisible();

    await page.getByRole("link", { name: "Finalizar compra" }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole("heading", { name: "Seu pedido" })).toBeVisible();
    if (await page.getByLabel("Quem vai receber").isVisible()) {
      await page.getByLabel("Quem vai receber").fill("Comprador Teste");
      await page.getByLabel("CEP").fill("01001-000");
      await page.getByLabel("Rua").fill("Praça da Sé");
      await page.getByLabel("Número").fill("1");
      await page.getByLabel("Bairro").fill("Sé");
      await page.getByLabel("Cidade").fill("São Paulo");
      await page.getByLabel("UF").selectOption("SP");
      await page.getByRole("button", { name: "Salvar endereço" }).click();
      await expect(page.getByText("Entregar em").filter({ visible: true }).first()).toBeVisible();
    }
    await page.getByRole("button", { name: "Finalizar compra" }).click();
    await expect(page).toHaveURL(/\/conta\/pedidos\/[0-9a-f-]{36}\?novo=1/);
    await expect(page.getByText("Aguardando pagamento").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(`2× ${title}`).filter({ visible: true }).first()).toBeVisible();

    await page.goto(productUrl);
    await expect(page.getByText("1 disponível").filter({ visible: true }).first()).toBeVisible();

    await page.goBack();
    await page.goto("/conta/pedidos");
    await page.getByRole("link", { name: /Pedido #/ }).first().click();
    await page.getByRole("button", { name: "Cancelar pedido" }).click();
    await expect(page.getByText("Cancelado", { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await page.goto(productUrl);
    await expect(page.getByText("3 disponíveis").filter({ visible: true }).first()).toBeVisible();
    await logout(page);
  });

  test("vendedor vê o pedido cancelado e tira o produto de venda (limpeza)", async ({ page }) => {
    await login(page, SELLER, "/seller/pedidos");
    await expect(page.getByText(`2× ${title}`).filter({ visible: true }).first()).toBeVisible();
    await page.goto(productUrl.replace("/produto/", "/seller/produtos/"));
    await page.getByLabel("Situação").selectOption("paused");
    await page.getByRole("button", { name: "Salvar produto" }).click();
    await expect(page.locator("main [role=status]").last()).toContainText("Produto salvo");
  });

  test("comprador sem loja que abre /seller é levado para /vender", async ({ page }) => {
    await login(page, BUYER, "/seller");
    await expect(page.getByRole("button", { name: "Abrir minha loja" })).toBeVisible();
    await expect(page).toHaveURL(/\/vender$/);
  });
});
