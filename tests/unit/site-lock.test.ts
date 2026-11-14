import { afterEach, describe, expect, it, vi } from "vitest";
import { accessToken, hasAccess, isOpenPath, safeNext, siteLocked } from "@/lib/site-lock";

afterEach(() => vi.unstubAllEnvs());

describe("site em construção", () => {
  it("só bloqueia com a senha definida", () => {
    vi.stubEnv("SITE_ACCESS_PASSWORD", "");
    expect(siteLocked()).toBe(false);
    vi.stubEnv("SITE_ACCESS_PASSWORD", "1234");
    expect(siteLocked()).toBe(true);
  });

  it.each([
    ["/em-construcao", true],
    ["/api/health", true],
    ["/api/webhooks/stripe", true],
    ["/api/jobs/repasses", true],
    ["/brand/zexi-logo-branco.svg", true],
    ["/", false],
    ["/market", false],
    ["/admin", false],
    ["/api/outra", false],
  ])("%s aberto? %s", (path, open) => expect(isOpenPath(path)).toBe(open));

  it("cookie vale só para a senha atual e não contém a senha", async () => {
    vi.stubEnv("SITE_ACCESS_PASSWORD", "1234");
    const token = await accessToken("1234");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(token).not.toContain("1234");
    expect(await hasAccess(token)).toBe(true);
    expect(await hasAccess(await accessToken("9999"))).toBe(false);
    expect(await hasAccess(undefined)).toBe(false);
    vi.stubEnv("SITE_ACCESS_PASSWORD", "4321");
    expect(await hasAccess(token)).toBe(false);
  });

  it("depois da senha só volta para páginas do próprio site", () => {
    expect(safeNext("/market?q=tenis")).toBe("/market?q=tenis");
    expect(safeNext("//golpe.com")).toBe("/");
    expect(safeNext("https://golpe.com")).toBe("/");
    expect(safeNext("/em-construcao")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});
