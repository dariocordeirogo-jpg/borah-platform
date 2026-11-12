import { describe, expect, it } from "vitest";
import { isReferralCode, referralLink, toInternalPath } from "@/lib/affiliates/format";

const SITE = "https://zexi.com.br";

describe("links de indicação", () => {
  it("link geral e link para uma página", () => {
    expect(referralLink(SITE, "ana1a2b")).toBe("https://zexi.com.br/r/ana1a2b");
    expect(referralLink(`${SITE}/`, "ana1a2b", "/produto/abc?x=1")).toBe("https://zexi.com.br/r/ana1a2b?to=%2Fproduto%2Fabc%3Fx%3D1");
  });

  it.each([
    ["https://zexi.com.br/produto/abc", "/produto/abc"],
    ["zexi.com.br/leiloes?aba=encerrados", "/leiloes?aba=encerrados"],
    ["www.zexi.com.br/loja/x", "/loja/x"],
    ["/market", "/market"],
    ["http://localhost:3000/produto/1", null],
    ["https://golpe.com/produto/abc", null],
    ["https://zexi.com.br.golpe.com/x", null],
    ["//golpe.com", null],
    ["/r/outro123", null],
    ["", null],
  ])("%s → %s", (input, out) => expect(toInternalPath(input, SITE)).toBe(out));

  it("aceita o próprio host em desenvolvimento", () => {
    expect(toInternalPath("http://localhost:3000/produto/1", "http://localhost:3000")).toBe("/produto/1");
  });

  it("formato do código", () => {
    expect(isReferralCode("joao1a2b")).toBe(true);
    expect(isReferralCode("ab")).toBe(false);
    expect(isReferralCode("../etc")).toBe(false);
    expect(isReferralCode(undefined)).toBe(false);
  });
});
