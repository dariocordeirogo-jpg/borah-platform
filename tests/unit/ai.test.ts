import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { clampTriage, draftToText, intentToMarketParams, type SearchIntent } from "@/lib/ai/schemas";
import { searchSystem } from "@/lib/ai/prompts";

vi.mock("server-only", () => ({}));

const parse = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    beta = { messages: { parse } };
  }
  return { default: Anthropic };
});

const base: SearchIntent = { terms: "tênis corrida", category: null, min_price_reais: null, max_price_reais: null, condition: null, sort: "recentes" };

describe("busca inteligente → filtros", () => {
  const slugs = ["moda", "esportes"];
  it("monta os filtros válidos", () => {
    const p = intentToMarketParams({ ...base, category: "esportes", max_price_reais: 300, condition: "used", sort: "menor-preco" }, slugs, "x");
    expect(p.toString()).toBe("q=t%C3%AAnis+corrida&categoria=esportes&preco_max=300&condicao=used&ordem=menor-preco");
  });
  it("ignora categoria inventada e faixa invertida", () => {
    const p = intentToMarketParams({ ...base, category: "armas", min_price_reais: 500, max_price_reais: 100 }, slugs, "x");
    expect(p.get("categoria")).toBeNull();
    expect(p.get("preco_min")).toBe("500");
    expect(p.get("preco_max")).toBeNull();
  });
  it("sem termos usa a frase original", () => {
    expect(intentToMarketParams({ ...base, terms: "  " }, slugs, "algo barato").get("q")).toBe("algo barato");
  });
  it("lista de categorias entra nas instruções", () => {
    expect(searchSystem([{ slug: "moda", name: "Moda" }])).toContain("- moda: Moda");
  });
});

describe("descrição e triagem", () => {
  it("junta descrição e destaques, no limite do campo", () => {
    expect(draftToText({ description: "Bolsa de couro.", highlights: [" Alça regulável ", ""] })).toBe("Bolsa de couro.\n\n• Alça regulável");
    expect(draftToText({ description: "a".repeat(6000), highlights: [] })).toHaveLength(5000);
  });
  it("justificativa limitada e nunca vazia", () => {
    expect(clampTriage({ severity: "alta", recommendation: "agir", rationale: "  " }).rationale).toBe("Sem justificativa.");
    expect(clampTriage({ severity: "baixa", recommendation: "revisar", rationale: "x".repeat(900) }).rationale).toHaveLength(600);
  });
});

describe("chamada ao Claude", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    parse.mockReset();
  });

  it("sem chave a IA fica desligada e nada é chamado", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { structured, aiConfigured } = await import("@/lib/ai/claude");
    expect(aiConfigured()).toBe(false);
    expect(await structured({ schema: z.object({ a: z.string() }), system: "s", content: [], effort: "low" })).toBeNull();
    expect(parse).not.toHaveBeenCalled();
  });

  it("modelo, fallback, cache, esforço e esquema no pedido", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-teste");
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { a: "ok" } });
    const { structured } = await import("@/lib/ai/claude");
    const out = await structured({ schema: z.object({ a: z.string() }), system: "regras", content: [{ type: "text", text: "oi" }], effort: "low" });
    expect(out).toEqual({ a: "ok" });
    const req = parse.mock.calls[0][0];
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.fallbacks).toBe("default");
    expect(req.betas).toContain("server-side-fallback-2026-07-01");
    expect(req.system[0]).toMatchObject({ text: "regras", cache_control: { type: "ephemeral" } });
    expect(req.output_config.effort).toBe("low");
    expect(req.output_config.format).toBeTruthy();
    expect(req.thinking).toBeUndefined();
  });

  it("recusa ou resposta cortada viram null", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-teste");
    const { structured } = await import("@/lib/ai/claude");
    parse.mockResolvedValueOnce({ stop_reason: "refusal", parsed_output: null });
    expect(await structured({ schema: z.object({}), system: "s", content: [], effort: "low" })).toBeNull();
    parse.mockResolvedValueOnce({ stop_reason: "max_tokens", parsed_output: null });
    expect(await structured({ schema: z.object({}), system: "s", content: [], effort: "low" })).toBeNull();
  });
});
