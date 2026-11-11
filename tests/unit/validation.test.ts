import { describe, expect, it } from "vitest";
import { safeNextPath, signInSchema, signUpSchema } from "@/lib/validation";

describe("safeNextPath (proteção contra open redirect)", () => {
  it("aceita caminhos internos", () => {
    expect(safeNextPath("/conta")).toBe("/conta");
    expect(safeNextPath("/leiloes?x=1")).toBe("/leiloes?x=1");
  });
  it("recusa URLs externas e truques", () => {
    expect(safeNextPath("https://malicioso.com")).toBe("/conta");
    expect(safeNextPath("//malicioso.com")).toBe("/conta");
    expect(safeNextPath("/\\malicioso.com")).toBe("/conta");
    expect(safeNextPath(undefined)).toBe("/conta");
    expect(safeNextPath(123)).toBe("/conta");
  });
});

describe("signUpSchema", () => {
  const valid = { displayName: "Ana", email: "ANA@Exemplo.com ", password: "senha123", acceptTerms: "on" };
  it("aceita cadastro válido e normaliza o e-mail", () => {
    const r = signUpSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("ana@exemplo.com");
  });
  it("exige aceite dos termos", () => {
    expect(signUpSchema.safeParse({ ...valid, acceptTerms: undefined }).success).toBe(false);
  });
  it("exige senha com 8+ caracteres, letra e número", () => {
    expect(signUpSchema.safeParse({ ...valid, password: "curta1" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, password: "sónumeros" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, password: "12345678" }).success).toBe(false);
  });
  it("exige nome com pelo menos 2 letras", () => {
    expect(signUpSchema.safeParse({ ...valid, displayName: " A " }).success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("recusa e-mail inválido", () => {
    expect(signInSchema.safeParse({ email: "nao-e-email", password: "x" }).success).toBe(false);
  });
});

describe("newPasswordSchema", () => {
  it("exige confirmação igual", async () => {
    const { newPasswordSchema } = await import("@/lib/validation");
    expect(newPasswordSchema.safeParse({ password: "senha123", confirm: "senha123" }).success).toBe(true);
    expect(newPasswordSchema.safeParse({ password: "senha123", confirm: "senha124" }).success).toBe(false);
  });
});
