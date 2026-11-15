import { describe, expect, it } from "vitest";
import { questionErrorMessage, timeAgo } from "@/lib/questions/format";

describe("Perguntas e respostas: textos", () => {
  it("explica por que contato fora da Zexi é recusado", () => {
    expect(questionErrorMessage("contact_not_allowed")).toContain("Compra Garantida");
    expect(questionErrorMessage("invalid_question")).toContain("5 a 500");
    expect(questionErrorMessage("qualquer")).toBe("Não foi possível enviar agora. Tente de novo.");
  });
  it("mostra há quanto tempo", () => {
    const now = Date.parse("2026-11-15T12:00:00Z");
    expect(timeAgo("2026-11-15T11:59:30Z", now)).toBe("agora");
    expect(timeAgo("2026-11-15T11:45:00Z", now)).toBe("há 15 min");
    expect(timeAgo("2026-11-15T09:00:00Z", now)).toBe("há 3 h");
    expect(timeAgo("2026-11-14T12:00:00Z", now)).toBe("há 1 dia");
    expect(timeAgo("2026-09-01T12:00:00Z", now)).toBe("01/09/2026");
  });
});
