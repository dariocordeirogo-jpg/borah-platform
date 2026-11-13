import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Em máquinas atrás de proxy (ex.: ambiente de nuvem), o navegador de teste usa o mesmo proxy para buscar as
// fotos no Supabase. Fora disso, nada muda.
const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    locale: "pt-BR",
    ...(proxyServer
      ? { proxy: { server: proxyServer, bypass: "localhost,127.0.0.1" }, ignoreHTTPSErrors: true }
      : {}),
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    // ZEXI_IMPORT_ALLOW_LOOPBACK: só nos testes, deixa o importador ler o servidor de exemplo em 127.0.0.1
    env: { NEXT_IMAGE_UNOPTIMIZED: "1", ZEXI_IMPORT_ALLOW_LOOPBACK: "1" },
    timeout: 120_000,
  },
});
