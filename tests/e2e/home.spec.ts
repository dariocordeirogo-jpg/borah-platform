import { expect, test } from "@playwright/test";

test("home mostra BORAH LANCES em destaque e o aviso de demonstração", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Entre na disputa");
  await expect(page.getByText("BORAH LANCES").first()).toBeVisible();
  await expect(page.getByText(/são demonstrações/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ao vivo agora" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Terminando em breve" })).toBeVisible();
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
