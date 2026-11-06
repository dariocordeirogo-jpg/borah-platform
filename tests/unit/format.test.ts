import { describe, expect, it } from "vitest";
import { formatBRL, formatCountdown } from "@/lib/format";

describe("formatBRL", () => {
  it("formata centavos em reais", () => {
    expect(formatBRL(38000).replace(/\s/g, " ")).toBe("R$ 380,00");
    expect(formatBRL(199).replace(/\s/g, " ")).toBe("R$ 1,99");
    expect(formatBRL(150000).replace(/\s/g, " ")).toBe("R$ 1.500,00");
  });
  it("recusa valores que não são centavos inteiros", () => {
    expect(() => formatBRL(10.5)).toThrow();
  });
});

describe("formatCountdown", () => {
  it("mostra Encerrado em zero ou negativo", () => {
    expect(formatCountdown(0)).toBe("Encerrado");
    expect(formatCountdown(-5)).toBe("Encerrado");
  });
  it("formata horas, minutos e segundos", () => {
    expect(formatCountdown(155)).toBe("00:02:35");
    expect(formatCountdown(3661)).toBe("01:01:01");
  });
  it("inclui dias quando passa de 24 h", () => {
    expect(formatCountdown(86400 + 5)).toBe("1d 00:00:05");
  });
});
