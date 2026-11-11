import { describe, expect, it } from "vitest";
import { formatCep, formatDays, formatWeight, normalizeCep, shippingErrorMessage, shippingTotal, type ShippingQuote } from "@/lib/shipping/format";

describe("frete", () => {
  it.each([
    ["01001-000", "01001000"],
    ["01001000", "01001000"],
    [" 20040 002 ", "20040002"],
    ["1234", null],
    ["00000-000", null],
  ])("CEP %s → %s", (input, out) => expect(normalizeCep(input)).toBe(out));

  it("formata CEP, prazo e peso", () => {
    expect(formatCep("01001000")).toBe("01001-000");
    expect(formatDays(1)).toBe("1 dia útil");
    expect(formatDays(8)).toBe("8 dias úteis");
    expect(formatWeight(800)).toBe("800 g");
    expect(formatWeight(1600)).toBe("1,6 kg");
  });

  it("soma o frete escolhido; loja sem CEP não soma (a combinar)", () => {
    const q: ShippingQuote[] = [
      { store_id: "a", store_name: "A", grams: 800, pac: { price_cents: 3770, days: 8 }, sedex: { price_cents: 6030, days: 3 } },
      { store_id: "b", store_name: "B", grams: 500, pac: null, sedex: null },
    ];
    expect(shippingTotal(q, "pac")).toBe(3770);
    expect(shippingTotal(q, "sedex")).toBe(6030);
  });

  it("erros do banco viram mensagens", () => {
    expect(shippingErrorMessage("shipping_too_heavy")).toContain("30 kg");
    expect(shippingErrorMessage("cart_empty")).toBeNull();
  });
});
