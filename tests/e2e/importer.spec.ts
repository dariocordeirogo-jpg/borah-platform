import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Importador de anúncios. Um servidor de exemplo em 127.0.0.1 faz o papel da "outra loja"
 * (o servidor de teste roda com ZEXI_IMPORT_ALLOW_LOOPBACK=1, só para 127.0.0.1; em produção isso não existe).
 */
const SELLER = { email: "e2e-vendedor@livelance.test", password: "Teste12345" };
const photo = readFileSync(path.join(__dirname, "fixtures", "produto.jpg"));
const run = Date.now();
const title = `Luminária Importada E2E ${run}`;

let server: Server;
let base = "";

function productPage(origin: string) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    description: "<p>Luminária de mesa com <b>LED</b>.</p><ul><li>3 temperaturas de cor</li></ul>",
    image: [`${origin}/fotos/1.jpg`, `${origin}/fotos/2.jpg`, `${origin}/nao-existe.jpg`],
    itemCondition: "https://schema.org/NewCondition",
    offers: {
      "@type": "Offer",
      price: "149.90",
      priceCurrency: "BRL",
      priceSpecification: [{ "@type": "UnitPriceSpecification", priceType: "https://schema.org/ListPrice", price: "199.90" }],
    },
  };
  return `<!doctype html><html><head><meta property="og:site_name" content="Loja de Exemplo"><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body>produto</body></html>`;
}

test.beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/produto/luminaria") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(productPage(base));
    } else if (req.url?.startsWith("/fotos/")) {
      res.writeHead(200, { "content-type": "image/jpeg" });
      res.end(photo);
    } else if (req.url === "/redireciona-interno") {
      res.writeHead(302, { location: "http://10.0.0.1/admin" });
      res.end();
    } else if (req.url === "/blog") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><head><title>Blog</title></head><body>texto</body></html>");
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(() => new Promise<void>((r) => server.close(() => r())));

async function login(page: Page) {
  await page.goto(`/entrar?next=${encodeURIComponent("/seller/produtos/importar")}`);
  await page.getByLabel("E-mail").fill(SELLER.email);
  await page.getByLabel("Senha", { exact: true }).fill(SELLER.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/seller/produtos/importar");
}

/** Envia o link e espera a resposta do servidor (a mensagem anterior continua na tela até a nova chegar). */
async function buscar(page: Page, url: string) {
  await page.getByLabel("Link do anúncio").fill(url);
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/seller/produtos/importar"),
    page.getByRole("button", { name: "Buscar anúncio" }).click(),
  ]);
}

test.describe("Importar anúncio de outro site", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "roda uma vez (desktop)"));

  test("recusa endereços internos, redirecionamento para a rede interna e páginas sem produto", async ({ page }) => {
    await login(page);
    await buscar(page, "http://169.254.169.254/latest/meta-data/");
    await expect(page.getByTestId("importar-erro")).toHaveText("Esse endereço não pode ser importado.");
    await buscar(page, `${base}/redireciona-interno`);
    await expect(page.getByTestId("importar-erro")).toHaveText("Esse endereço não pode ser importado.");
    await buscar(page, `${base}/blog`);
    await expect(page.getByTestId("importar-erro")).toContainText("Não encontramos os dados do produto");
    // Link sem https:// nem chega a ser buscado: o navegador recusa (campo do tipo URL) ou o servidor responde com a orientação
    await page.getByLabel("Link do anúncio").fill("loja.com/x");
    await page.getByRole("button", { name: "Buscar anúncio" }).click();
    await expect(page.getByLabel("Link do anúncio")).toHaveJSProperty("validity.valid", false);
  });

  test("lê o anúncio, exige a confirmação de autoria e cria rascunho com as fotos", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page);
    await buscar(page, `${base}/produto/luminaria`);
    await expect(page.getByText("Loja de Exemplo")).toBeVisible();
    await expect(page.getByLabel("Título")).toHaveValue(title);
    await expect(page.getByLabel("Preço (R$)")).toHaveValue("149,90");
    await expect(page.getByLabel(/Preço anterior/)).toHaveValue("199,90");
    await expect(page.getByLabel(/Descrição/)).toHaveValue(/Luminária de mesa com LED/);
    await expect(page.getByRole("button", { name: /Foto \d/ })).toHaveCount(3);

    await page.getByLabel("Categoria").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Importar como rascunho" }).click();
    await expect(page.getByText(/Confirme que o anúncio é seu/)).toBeVisible();

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Importar como rascunho" }).click();
    await expect(page).toHaveURL(/\/seller\/produtos\/[0-9a-f-]{36}\?importado=2&fotos_falharam=1$/, { timeout: 45_000 });
    await expect(page.getByText(/Anúncio importado como rascunho com 2 fotos/)).toBeVisible();
    await expect(page.getByLabel("Título")).toHaveValue(title);
  });
});
