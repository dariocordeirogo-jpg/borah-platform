import { describe, expect, it } from "vitest";
import { colorLabel, emptyReputation, percent, ratingText, reputationBadges, reputationTitle, reviewErrorMessage, salesLabel } from "@/lib/reviews/format";

const base = emptyReputation;

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
    expect(reputationBadges({ ...base, sales: 12, answerRate: 0.9, delayRate: 0.05 })).toEqual(["Bom atendimento", "Entrega no prazo"]);
    expect(reputationBadges({ ...base, sales: 12, answerRate: 0.5, delayRate: 0.3 })).toEqual([]);
    // Entrega no prazo só depois das 5 primeiras vendas
    expect(reputationBadges({ ...base, sales: 3, delayRate: 0 })).toEqual([]);
  });
  it("nota com uma casa e cor da reputação", () => {
    expect(ratingText(4.5)).toBe("4,5");
    expect(ratingText(5)).toBe("5,0");
    expect(reputationTitle(base)).toBe("Loja nova");
    expect(reputationTitle({ ...base, sales: 10, color: "yellow" })).toBe(colorLabel.yellow);
    expect(colorLabel.red).toBe("Reputação vermelha");
    expect(percent(0.1)).toBe("10%");
    expect(percent(null)).toBe("—");
  });
  it("explica por que não dá para avaliar", () => {
    expect(reviewErrorMessage("not_delivered")).toContain("depois de receber");
    expect(reviewErrorMessage("review_window_closed")).toContain("60 dias");
  });
});
