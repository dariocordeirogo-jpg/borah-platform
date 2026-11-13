import { expect, test, type Page } from "@playwright/test";

const SELLER = { email: "e2e-vendedor@livelance.test", password: "Teste12345" };

async function login(page: Page, next: string) {
  await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("E-mail").fill(SELLER.email);
  await page.getByLabel("Senha", { exact: true }).fill(SELLER.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
}

test.describe("Vídeo do produto por link", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "roda uma vez (desktop)"));

  test("loja cola link do YouTube; a página do produto mostra o player oficial", async ({ page }) => {
    // Produto próprio do teste (não depende da ordem dos outros testes)
    await login(page, "/seller/produtos/novo");
    await page.getByLabel("Título").fill(`Caixa de som com vídeo E2E ${Date.now()}`);
    await page.getByLabel("Categoria").selectOption({ index: 1 });
    await page.getByLabel("Preço (R$)").fill("199,90");
    await page.getByRole("button", { name: "Criar produto" }).click();
    await page.waitForURL(/\/seller\/produtos\/[0-9a-f-]{36}\?criado=1/);
    const productId = new URL(page.url()).pathname.split("/").pop()!;
    // Carrega a página de edição do zero (a tela anterior fica guardada, escondida, pelo roteador)
    await page.goto(`/seller/produtos/${productId}`);

    // Link de outro site é recusado
    await page.getByLabel(/Vídeo do produto/).fill("https://vimeo.com/123456");
    await page.getByRole("button", { name: "Salvar produto" }).click();
    await expect(page.getByText("Use o link de um vídeo do YouTube, Instagram ou Facebook.")).toBeVisible();

    await page.getByLabel(/Vídeo do produto/).fill("https://youtu.be/dQw4w9WgXcQ?si=teste");
    await page.getByRole("button", { name: "Salvar produto" }).click();
    await expect(page.getByText("Produto salvo.")).toBeVisible();
    // Guardado no endereço oficial
    await page.reload();
    await expect(page.getByLabel(/Vídeo do produto/)).toHaveValue("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

    await page.goto(`/produto/${productId}`);
    const video = page.getByTestId("video-produto");
    await expect(video.locator("iframe")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1",
    );
    await expect(video.getByRole("link", { name: /Abrir no YouTube/ })).toHaveAttribute("href", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");

    // Remove o vídeo e o player some
    await page.goto(`/seller/produtos/${productId}`);
    await page.getByLabel(/Vídeo do produto/).fill("");
    await page.getByRole("button", { name: "Salvar produto" }).click();
    await expect(page.getByText("Produto salvo.")).toBeVisible();
    await page.goto(`/produto/${productId}`);
    await expect(page.getByTestId("video-produto")).toHaveCount(0);
  });
});
