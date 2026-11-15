import { describe, expect, it } from "vitest";
import { levelLabel, ratingText, reputationBadges, reviewErrorMessage, salesLabel } from "@/lib/reviews/format";

const base = { sales: 0, onTimeRate: null, answerRate: null, ratingAvg: null, ratingCount: 0, level: null };

describe("Avaliações e reputação: textos", () => {
  it("vendas em faixas, como nos marketplaces", () => {
    expect(salesLabel(0)).toBe("Ainda sem vendas");
    expect(salesLabel(1)).toBe("1 venda");
    expect(salesLabel(9)).toBe("9 vendas");
    expect(salesLabel(57)).toBe("+50 vendas");
    expect(salesLabel(1234)).toBe("+1.000 vendas");
  });
  it("selos só com dados bons", () => {
    expect(reputationBadges(base)).toEqual([]);
    expect(reputationBadges({ ...base, answerRate: 0.9, onTimeRate: 0.95 })).toEqual(["Bom atendimento", "Entrega no prazo"]);
    expect(reputationBadges({ ...base, answerRate: 0.5, onTimeRate: 0.7 })).toEqual([]);
  });
  it("nota com uma casa e níveis", () => {
    expect(ratingText(4.5)).toBe("4,5");
    expect(ratingText(5)).toBe("5,0");
    expect(levelLabel[5]).toBe("Excelente reputação");
  });
  it("explica por que não dá para avaliar", () => {
    expect(reviewErrorMessage("not_delivered")).toContain("depois de receber");
    expect(reviewErrorMessage("review_window_closed")).toContain("60 dias");
  });
});
