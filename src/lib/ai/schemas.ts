import { z } from "zod";

/**
 * Formatos que a IA devolve (structured outputs). Sem limites numéricos no esquema enviado ao modelo:
 * os limites são aplicados aqui depois, no código.
 */

export const DescriptionDraftSchema = z.object({
  description: z.string(),
  highlights: z.array(z.string()),
});
export type DescriptionDraft = z.infer<typeof DescriptionDraftSchema>;

export const CONDITIONS = ["new", "used", "refurbished"] as const;
export const SORTS = ["recentes", "menor-preco", "maior-preco"] as const;

export const SearchIntentSchema = z.object({
  terms: z.string(),
  category: z.string().nullable(),
  min_price_reais: z.number().nullable(),
  max_price_reais: z.number().nullable(),
  condition: z.enum(CONDITIONS).nullable(),
  sort: z.enum(SORTS),
});
export type SearchIntent = z.infer<typeof SearchIntentSchema>;

export const TriageSchema = z.object({
  severity: z.enum(["baixa", "media", "alta"]),
  recommendation: z.enum(["agir", "descartar", "revisar"]),
  rationale: z.string(),
});
export type Triage = z.infer<typeof TriageSchema>;

/** Descrição final: corta no limite do campo (5000) e junta os destaques em lista. */
export function draftToText(d: DescriptionDraft): string {
  const bullets = d.highlights
    .map((h) => h.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((h) => `• ${h}`);
  const text = [d.description.trim(), bullets.join("\n")].filter(Boolean).join("\n\n");
  return text.slice(0, 5000);
}

/** Converte a intenção de busca em parâmetros do /market, só com valores válidos. */
export function intentToMarketParams(intent: SearchIntent, categorySlugs: readonly string[], fallbackQuery: string): URLSearchParams {
  const p = new URLSearchParams();
  const terms = intent.terms.trim().slice(0, 100);
  p.set("q", terms || fallbackQuery.trim().slice(0, 100));
  if (intent.category && categorySlugs.includes(intent.category)) p.set("categoria", intent.category);
  const min = intent.min_price_reais != null && intent.min_price_reais > 0 ? Math.floor(intent.min_price_reais) : null;
  let max = intent.max_price_reais != null && intent.max_price_reais > 0 ? Math.ceil(intent.max_price_reais) : null;
  if (min != null && max != null && max < min) max = null;
  if (min != null) p.set("preco_min", String(Math.min(min, 10_000_000)));
  if (max != null) p.set("preco_max", String(Math.min(max, 10_000_000)));
  if (intent.condition) p.set("condicao", intent.condition);
  if (intent.sort !== "recentes") p.set("ordem", intent.sort);
  if (!p.get("q")) p.delete("q");
  return p;
}

export function clampTriage(t: Triage): Triage {
  return { ...t, rationale: t.rationale.trim().slice(0, 600) || "Sem justificativa." };
}
