import { expect, test } from "@playwright/test";

// Usuário de teste criado no projeto de desenvolvimento (e-mail confirmado). Não existe em produção.
const E2E_EMAIL = process.env.E2E_EMAIL ?? "e2e@livelance.test";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "Teste12345";

test("/conta sem login manda para /entrar", async ({ page }) => {
  await page.goto("/conta");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fconta|\/entrar\?next=\/conta/);
  await expect(page.getByRole("heading", { name: "Entrar na LIVELANCE" })).toBeVisible();
});

test("cadastro mostra erros de validação", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Seu nome precisa ter pelo menos 2 letras.")).toBeVisible();
  await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
  await expect(page.getByText("Você precisa aceitar os termos para criar a conta.")).toBeVisible();
});

test("senha errada mostra mensagem sem revelar se o e-mail existe", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(E2E_EMAIL);
  await page.getByLabel("Senha", { exact: true }).fill("senha-errada-1");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.locator("form p[role=alert]")).toHaveText("E-mail ou senha incorretos.");
});

test("login, conta, sair — e ignora redirecionamento externo", async ({ page }) => {
  await page.goto("/entrar?next=https://malicioso.example.com");
  await page.getByLabel("E-mail").fill(E2E_EMAIL);
  await page.getByLabel("Senha", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByRole("heading", { name: "Teste Automático" })).toBeVisible();
  await expect(page.getByText("Comprador")).toBeVisible();
  await expect(page.getByText("CPF: não verificado")).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("link", { name: /Olá, Teste|Minha conta/ }).first()).toBeAttached();

  await page.goto("/conta");
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/conta");
  await expect(page).toHaveURL(/\/entrar/);
});

test("botão do Google leva ao login do Google via Supabase", async ({ page }) => {
  await page.goto("/entrar");
  const req = page.waitForRequest((r) => r.url().includes("/auth/v1/authorize") && r.url().includes("provider=google"));
  await page.getByRole("button", { name: "Continuar com Google" }).click();
  const r = await req;
  expect(r.url()).toContain("elygbieuroidqxkifgou.supabase.co");
  expect(r.url()).toContain(encodeURIComponent("/auth/callback"));
});

test("recuperação de senha responde igual exista ou não a conta", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByRole("link", { name: "Esqueci minha senha" }).click();
  await expect(page).toHaveURL(/\/recuperar-senha$/);
  await page.getByLabel("E-mail da conta").fill("ninguem-cadastrado@livelance.test");
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByRole("status")).toContainText("Se existir uma conta com ninguem-cadastrado@livelance.test");
});

test("/nova-senha sem link de recuperação volta para /recuperar-senha", async ({ page }) => {
  await page.goto("/nova-senha");
  await expect(page).toHaveURL(/\/recuperar-senha$/);
});
