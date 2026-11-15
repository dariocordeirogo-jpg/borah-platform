import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { runTag } from "./run-tag";

/**
 * Importar anúncios em massa: planilha (formato Shopify e formato de marketplace com instruções acima do cabeçalho)
 * e lista de links. Fotos e páginas vêm de um servidor de exemplo em 127.0.0.1 (ZEXI_IMPORT_ALLOW_LOOPBACK=1 só nos testes).
 */
const SELLER = { email: "e2e-vendedor@livelance.test", password: "Teste12345" };
const photo = readFileSync(path.join(__dirname, "fixtures", "produto.jpg"));
const run = runTag();

let server: Server;
let base = "";

const page = (name: string, price: string) =>
  `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    image: [`${base}/fotos/${encodeURIComponent(name)}.jpg`],
    offers: { "@type": "Offer", price, priceCurrency: "BRL" },
  })}</script></head><body>produto</body></html>`;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url?.startsWith("/fotos/")) {
      res.writeHead(200, { "content-type": "image/jpeg" });
      res.end(photo);
    } else if (req.url === "/p/caneca") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page(`Caneca Links ${run}`, "39.90"));
    } else if (req.url === "/p/copo") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page(`Copo Links ${run}`, "24.50"));
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

async function open(p: Page) {
  await p.goto(`/entrar?next=${encodeURIComponent("/seller/produtos/importar-em-massa")}`);
  await p.getByLabel("E-mail").fill(SELLER.email);
  await p.getByLabel("Senha", { exact: true }).fill(SELLER.password);
  await p.getByRole("button", { name: "Entrar", exact: true }).click();
  await p.waitForURL((u) => u.pathname === "/seller/produtos/importar-em-massa");
}

async function confirmAndImport(p: Page, label: RegExp) {
  await p.getByLabel("Categoria dos anúncios").selectOption({ index: 1 });
  await p.getByRole("checkbox").check();
  await p.getByRole("button", { name: label }).click();
}

test.describe("Importar anúncios em massa", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "roda uma vez (desktop)"));

  test("planilha do Shopify: junta as variações, copia as fotos e cria rascunhos", async ({ page: p }) => {
    test.setTimeout(90_000);
    await open(p);
    const csv = [
      "Handle,Title,Body (HTML),Vendor,Variant Price,Variant Compare At Price,Variant Inventory Qty,Image Src",
      `bone-${run},Boné Planilha ${run},<p>Algodão</p>,Zexi,49.90,79.90,10,${base}/fotos/bone1.jpg`,
      `bone-${run},,,,,,,${base}/fotos/bone2.jpg`,
      `meia-${run},Meia Planilha ${run},,,19.90,,0,`,
      `sem-preco-${run},Sem Preço ${run},,,,,1,`,
    ].join("\n");
    await p.getByLabel("Planilha de anúncios").setInputFiles({ name: "produtos_shopify.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(p.getByTestId("planilha-resumo")).toContainText("Shopify");
    await expect(p.getByTestId("planilha-resumo")).toContainText("3 anúncio(s)");
    await expect(p.getByLabel("Coluna de Título")).toHaveValue("1");
    await expect(p.getByTestId("planilha-previa")).toContainText("R$ 49,90");

    // Sem categoria e sem confirmar autoria não importa
    await p.getByRole("button", { name: /Importar 3 anúncio/ }).click();
    await expect(p.getByRole("alert").filter({ hasText: "categoria" })).toBeVisible();

    await confirmAndImport(p, /Importar 3 anúncio/);
    const result = p.getByTestId("resultado-importacao");
    await expect(result).toContainText("2 de 3 criado(s) como rascunho", { timeout: 60_000 });
    await expect(result.getByRole("listitem").filter({ hasText: `Boné Planilha ${run}` })).toContainText("2 fotos");
    await expect(result.getByRole("listitem").filter({ hasText: `Sem Preço ${run}` })).toContainText("Sem preço");

    await result.getByRole("link", { name: /Revisar/ }).first().click();
    await expect(p).toHaveURL(/\/seller\/produtos\/[0-9a-f-]{36}$/);
    await expect(p.getByLabel("Título", { exact: true })).toHaveValue(`Boné Planilha ${run}`);
    await expect(p.getByLabel("Preço (R$)")).toHaveValue("49,90");
  });

  test("planilha de marketplace (.csv com instruções acima): acha o cabeçalho; não duplica o mesmo link", async ({ page: p }) => {
    test.setTimeout(60_000);
    await open(p);
    const csv = [
      "Não altere o cabeçalho;;;;",
      "ID do anúncio;Título;Preço;Quantidade disponível;Link",
      `MLB${run};Fone Marketplace ${run};R$ 1.299,90;4;${base}/anuncio/fone-${run}`,
    ].join("\n");
    const upload = () => p.getByLabel("Planilha de anúncios").setInputFiles({ name: "anuncios.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await upload();
    await expect(p.getByTestId("planilha-resumo")).toContainText("Mercado Livre");
    await expect(p.getByTestId("planilha-previa")).toContainText("R$ 1.299,90");
    await confirmAndImport(p, /Importar 1 anúncio/);
    await expect(p.getByTestId("resultado-importacao")).toContainText("1 de 1 criado(s)", { timeout: 30_000 });

    // Mesma planilha de novo: o anúncio com o mesmo link não é criado outra vez
    await p.getByRole("button", { name: /Importar 1 anúncio/ }).click();
    await expect(p.getByTestId("resultado-importacao")).toContainText("Já importado antes.", { timeout: 30_000 });
  });

  test("vários links: importa as páginas de produto e avisa as que não são", async ({ page: p }) => {
    test.setTimeout(90_000);
    await open(p);
    await p.getByRole("tab", { name: "Vários links" }).click();
    await p.getByLabel("Links dos anúncios").fill(`${base}/p/caneca\n${base}/p/copo\n${base}/blog\nnao-e-link`);
    await expect(p.getByText("3 link(s) válido(s).")).toBeVisible();
    await confirmAndImport(p, /Importar 3 anúncio/);
    const result = p.getByTestId("resultado-importacao");
    await expect(result).toContainText("2 de 3 criado(s)", { timeout: 60_000 });
    await expect(result).toContainText(`Caneca Links ${run}`);
    await expect(result).toContainText("A página não traz os dados do produto.");
  });
});
