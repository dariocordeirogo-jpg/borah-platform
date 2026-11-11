import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

/**
 * Cliente do Claude (só no servidor). Sem ANTHROPIC_API_KEY a IA fica "em configuração".
 * Modelo: Claude Opus 5.5. Recusa de segurança cai num modelo de reserva escolhido pela própria API
 * (fallbacks "default"); se a cadeia inteira recusar, a função devolve null e a tela segue sem IA.
 */
export const AI_MODEL = "claude-opus-5-5";

let cached: Anthropic | null = null;

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function client(): Anthropic | null {
  if (!aiConfigured()) return null;
  cached ??= new Anthropic({ timeout: 60_000, maxRetries: 2 });
  return cached;
}

export type ContentBlock = Anthropic.Beta.BetaContentBlockParam;

/** Uma chamada com saída estruturada (JSON validado pelo esquema). */
export async function structured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  content: ContentBlock[];
  effort: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<S> | null> {
  const claude = client();
  if (!claude) return null;
  const response = await claude.beta.messages.parse({
    model: AI_MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // Instruções fixas primeiro (podem ser reaproveitadas do cache); o conteúdo variável vem depois
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.content }],
    output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
  });
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
  return (response.parsed_output as z.infer<S> | null) ?? null;
}
