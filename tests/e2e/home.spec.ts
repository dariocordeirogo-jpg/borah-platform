import { expect, test } from "@playwright/test";

test("home Zexi: slogan, três modalidades e aviso de demonstração", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Zexi | Marketplace, Vendas ao Vivo e Leilões Online");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Tudo acontece");
  for (const name of [/Compre agora/, /Assista e compre/, /Dê seu lance/]) {
    await expect(page.getByRole("link", { name }).first()).toBeVisible();
  }
  await expect(page.getByText(/“Demonstração” não são reais/).first()).toBeVisible();
  for (const h of ["Transmissões ao vivo", "Leilões terminando", "Ofertas do Market", "Próximos leilões"]) {
    await expect(page.getByRole("heading", { name: h })).toBeVisible();
  }
});

test("carrossel de banners troca pelas setas e pelas bolinhas; atalhos levam às modalidades", async ({ page }, info) => {
  await page.goto("/");
  const first = page.getByTestId("slide-ao-vivo");
  await expect(first).toHaveAttribute("aria-hidden", "false");
  await expect(first.getByRole("heading", { name: /Tudo acontece ao vivo/ })).toBeVisible();
  await page.getByRole("button", { name: "Ir para o banner 3" }).click();
  await expect(page.getByTestId("slide-leiloes")).toHaveAttribute("aria-hidden", "false");
  await expect(first).toHaveAttribute("aria-hidden", "true");
  if (info.project.name === "desktop") {
    await page.getByRole("button", { name: "Próximo banner" }).click();
    await expect(page.getByTestId("slide-cupons")).toHaveAttribute("aria-hidden", "false");
    await page.getByRole("button", { name: "Banner anterior" }).click();
    await expect(page.getByTestId("slide-leiloes")).toHaveAttribute("aria-hidden", "false");
  }
  const atalhos = page.getByRole("region", { name: "Atalhos" });
  await expect(atalhos.getByRole("link", { name: /Até R\$ 100/ })).toHaveAttribute("href", "/market?preco_max=100");
  await expect(atalhos.getByRole("link", { name: /Venda na Zexi/ })).toHaveAttribute("href", "/vender");
});

test("nenhuma menção às marcas antigas (BORAH, LIVELANCE) na página", async ({ page }) => {
  for (const path of ["/", "/entrar", "/cadastro", "/recuperar-senha", "/leiloes", "/ao-vivo", "/market", "/vender", "/termos", "/privacidade", "/indique"]) {
    await page.goto(path);
    // A loja das contas de teste ("Loja E2E LIVELANCE") é dado do banco de desenvolvimento, não texto do site
    const html = (await page.content()).replaceAll("Loja E2E LIVELANCE", "");
    expect(html, path).not.toMatch(/b[o0]r[aλΛ]h/i);
    expect(html, path).not.toMatch(/livelance/i);
  }
});

test("marca Zexi: logo no cabeçalho, ícones e manifesto", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Zexi — página inicial" }).first()).toBeVisible();
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toBe("Zexi");
  expect(manifest.theme_color).toBe("#0F1115");
  for (const icon of ["/brand/zexi-simbolo.svg", "/brand/icon-192.png", "/icon.svg", "/apple-icon.png"]) {
    expect((await request.get(icon)).status(), icon).toBe(200);
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
  expect(manifest.name).toBe("Zexi");
  const og = await request.get("/opengraph-image");
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toContain("image/png");
});

test("cronômetro anda no navegador", async ({ page }) => {
  await page.goto("/");
  const timer = page.locator("main span.font-mono").filter({ visible: true }).first();
  await expect(timer).not.toHaveText("--:--:--");
  const first = await timer.textContent();
  await page.waitForTimeout(1500);
  expect(await timer.textContent()).not.toBe(first);
});

test("sem rolagem horizontal nas páginas principais", async ({ page }) => {
  for (const path of ["/", "/market", "/leiloes", "/ao-vivo", "/vender", "/carrinho", "/entrar"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("vitrine no padrão marketplace: card inteiro clicável, foto, preço e marca de demonstração", async ({ page }) => {
  await page.goto("/");
  const ofertas = page.getByRole("list", { name: "Ofertas do Market" });
  await expect(ofertas.getByRole("listitem").first()).toBeVisible();
  // Os cards trazem foto (no celular só os 4 primeiros ficam visíveis; os itens de teste locais não têm foto)
  expect(await ofertas.locator("article img").count()).toBeGreaterThan(0);
  for (const card of await ofertas.locator("article").filter({ visible: true }).all()) {
    await expect(card).toContainText("R$");
    // O card inteiro é o link (um só link por card)
    await expect(card.getByRole("link")).toHaveCount(1);
  }
  // Nenhuma promessa que a plataforma ainda não cumpre
  await expect(page.locator("main")).not.toContainText(/em até \d+x|frete grátis/i);
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
