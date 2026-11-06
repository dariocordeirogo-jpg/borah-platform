import { expect, test } from "@playwright/test";

test("home LIVELANCE: slogan, três modalidades e aviso de demonstração", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("LIVELANCE | Marketplace, Vendas ao Vivo e Leilões Online");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Tudo acontece");
  for (const name of [/Compre agora/, /Assista e compre/, /Dê seu lance/]) {
    await expect(page.getByRole("link", { name }).first()).toBeVisible();
  }
  await expect(page.getByText(/são demonstrações/).first()).toBeVisible();
  for (const h of ["Transmissões ao vivo", "Leilões em andamento", "Produtos em destaque e ofertas"]) {
    await expect(page.getByRole("heading", { name: h })).toBeVisible();
  }
});

test("nenhuma menção à marca antiga na página", async ({ page }) => {
  for (const path of ["/", "/entrar", "/cadastro", "/recuperar-senha", "/leiloes", "/ao-vivo", "/market", "/vender", "/termos"]) {
    await page.goto(path);
    const html = await page.content();
    expect(html, path).not.toMatch(/b[o0]r[aλΛ]h/i);
  }
});

test("/lances redireciona para /leiloes", async ({ page }) => {
  await page.goto("/lances");
  await expect(page).toHaveURL(/\/leiloes$/);
});

test("SEO: robots, sitemap, manifest e imagem de compartilhamento", async ({ request }) => {
  expect((await request.get("/robots.txt")).status()).toBe(200);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/leiloes");
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toBe("LIVELANCE");
  const og = await request.get("/opengraph-image");
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toContain("image/png");
});

test("cronômetro anda no navegador", async ({ page }) => {
  await page.goto("/");
  const timer = page.locator("main span.font-mono").first();
  await expect(timer).not.toHaveText("--:--:--");
  const first = await timer.textContent();
  await page.waitForTimeout(1500);
  expect(await timer.textContent()).not.toBe(first);
});

test("sem rolagem horizontal", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("todos os links internos da home abrem (nenhum botão sem destino)", async ({ page, request }) => {
  await page.goto("/");
  const hrefs = await page.$$eval("a[href^='/']", (as) => [...new Set(as.map((a) => a.getAttribute("href")!))]);
  expect(hrefs.length).toBeGreaterThan(10);
  for (const href of hrefs) {
    const res = await request.get(href, { maxRedirects: 0 });
    expect([200, 307, 308], `link ${href}`).toContain(res.status());
  }
});

test("screenshot da home", async ({ page }, info) => {
  await page.goto("/");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/home-${info.project.name}.png`, fullPage: true });
});
