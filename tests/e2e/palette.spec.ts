import { expect, test } from "@playwright/test";

const PAGES = ["/", "/entrar", "/cadastro", "/recuperar-senha", "/leiloes", "/ao-vivo", "/market", "/vender", "/termos"];

test("nenhum verde residual (exceto mensagens de status)", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    const greens = await page.evaluate(() => {
      const parse = (c: string) => c.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
      const isGreen = (c: string) => {
        const [r, g, b, a = 1] = parse(c);
        return a > 0.05 && g > r + 30 && g > b + 10;
      };
      const found: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
        if (el.closest("[role=status]")) continue;
        const cs = getComputedStyle(el);
        for (const prop of ["color", "backgroundColor", "borderTopColor"] as const) {
          if (isGreen(cs[prop])) found.push(`${el.tagName}.${el.className}: ${prop} ${cs[prop]}`);
        }
      }
      return found.slice(0, 5);
    });
    expect(greens, path).toEqual([]);
  }
});

test("dourado só em botões de comprar e dar lance", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    const result = await page.evaluate(() => {
      const goldish = /rgb\((2[0-4]\d|23\d), (1[3-9]\d|20\d), (2\d|3\d|[4-9]\d)\)/; // família #D6A638 / #B88720 / #E8C25E
      const offenders: string[] = [];
      const buyTexts: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
        const cs = getComputedStyle(el);
        const hasGold = goldish.test(cs.backgroundImage) || goldish.test(cs.backgroundColor) || goldish.test(cs.color);
        if (!hasGold) continue;
        if (el.classList.contains("btn-buy")) buyTexts.push(el.textContent?.trim() ?? "");
        else offenders.push(`${el.tagName}.${el.className}`);
      }
      return { offenders: offenders.slice(0, 5), buyTexts };
    });
    expect(result.offenders, path).toEqual([]);
    for (const t of result.buyTexts) {
      expect(t, path).toMatch(/Comprar|Dar lance|Finalizar compra|Confirmar lance|Fazer oferta/);
    }
  }
});
