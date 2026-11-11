import { describe, expect, it } from "vitest";
import { couponDiscount, couponErrorMessage, describeCoupon, isCouponCode, normalizeCouponCode } from "@/lib/coupons/format";

const pct = (p: number, min = 0) => ({ kind: "percent" as const, percent_off: p, amount_off_cents: null, min_subtotal_cents: min });
const fixed = (c: number, min = 0) => ({ kind: "fixed" as const, percent_off: null, amount_off_cents: c, min_subtotal_cents: min });

describe("cupons", () => {
  it.each([
    [" bemvindo10 ", true],
    ["AB", false],
    ["COM-HIFEN", false],
    ["A".repeat(21), false],
    ["NATAL2026", true],
  ])("código %s → %s", (code, ok) => expect(isCouponCode(code)).toBe(ok));

  it("normaliza para maiúsculas sem espaços nas pontas", () => expect(normalizeCouponCode("  dez10 ")).toBe("DEZ10"));

  it("desconto igual ao do banco (arredonda para baixo, nunca zera o pedido)", () => {
    expect(couponDiscount(pct(10), 10000)).toBe(1000);
    expect(couponDiscount(pct(15), 999)).toBe(149);
    expect(couponDiscount(fixed(2000), 10000)).toBe(2000);
    expect(couponDiscount(fixed(20000), 10000)).toBe(9900);
    expect(couponDiscount(fixed(500), 100)).toBe(0);
    expect(couponDiscount(fixed(20000), 10000, 2000)).toBe(10000);
  });

  it("descrição em português", () => {
    expect(describeCoupon(pct(10))).toBe("10% de desconto");
    expect(describeCoupon(fixed(2000, 10000)).replace(/ /g, " ")).toBe("R$ 20,00 de desconto em compras a partir de R$ 100,00");
  });

  it("erros do banco viram mensagens", () => {
    expect(couponErrorMessage("coupon_used")).toBe("Você já usou este cupom.");
    expect(couponErrorMessage("coupon_min_subtotal:15000")?.replace(/ /g, " ")).toContain("R$ 150,00");
    expect(couponErrorMessage("cart_empty")).toBeNull();
  });
});
