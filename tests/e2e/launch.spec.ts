import { expect, test } from "@playwright/test";

test("health: banco responde e nenhum segredo é exposto", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toContain("no-store");
  const body = await res.json();
  expect(body).toMatchObject({ ok: true, db: "ok" });
  expect(typeof body.integrations.stripe).toBe("boolean");
  expect(typeof body.integrations.ai).toBe("boolean");
  expect(JSON.stringify(body)).not.toMatch(/sk_|whsec_|sb_secret|service_role/);
});

test("cabeçalhos de segurança na home", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["strict-transport-security"]).toContain("max-age=63072000");
  expect(h["cross-origin-opener-policy"]).toBe("same-origin");
  expect(h["x-content-type-options"]).toBe("nosniff");
});

test("rodapé avisa que é versão de testes; termos e privacidade são rascunho", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("contentinfo").getByText(/versão de testes/)).toBeVisible();
  for (const path of ["/termos", "/privacidade"]) {
    await page.goto(path);
    await expect(page.getByText(/^RASCUNHO/)).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: /Encarregado/ })).toBeVisible();
});
