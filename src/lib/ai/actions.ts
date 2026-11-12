"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { aiConfigured, structured, type ContentBlock } from "@/lib/ai/claude";
import { DESCRIPTION_SYSTEM, searchSystem, TRIAGE_SYSTEM } from "@/lib/ai/prompts";
import { clampTriage, DescriptionDraftSchema, draftToText, intentToMarketParams, SearchIntentSchema, TriageSchema } from "@/lib/ai/schemas";
import { reportReasons, type ReportReason } from "@/lib/admin/format";
import { conditionLabel, formatBRLText } from "@/lib/ai/text";
import { productImageUrl } from "@/lib/market/images";
import { createClient } from "@/lib/supabase/server";

const uuid = z.uuid();

function aiError(e: unknown): string {
  if (e instanceof Anthropic.RateLimitError) return "A IA está muito ocupada agora. Tente de novo em instantes.";
  if (e instanceof Anthropic.APIError) return "A IA não respondeu agora. Tente de novo.";
  return "Não foi possível usar a IA agora. Tente de novo.";
}

/** Vendedor: rascunho de descrição a partir do título, categoria, condição e (se já houver) fotos. */
export async function generateDescription(input: {
  productId?: string;
  title: string;
  categoryId?: number | null;
  condition: "new" | "used" | "refurbished";
}): Promise<{ text?: string; error?: string }> {
  if (!aiConfigured()) return { error: "A IA da Zexi está em configuração." };
  const title = input.title.trim();
  if (title.length < 3) return { error: "Escreva o título do produto primeiro." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Entre na sua conta para continuar." };
  const { data: store } = await supabase.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (!store) return { error: "Abra sua loja para usar a IA." };

  const [{ data: allowed }, { data: category }, images] = await Promise.all([
    supabase.rpc("ai_take_quota", { _feature: "description" }),
    input.categoryId ? supabase.from("categories").select("name").eq("id", input.categoryId).maybeSingle() : Promise.resolve({ data: null }),
    input.productId && uuid.safeParse(input.productId).success
      ? supabase
          .from("product_images")
          .select("path, position, products!inner(store_id)")
          .eq("product_id", input.productId)
          .eq("products.store_id", store.id)
          .order("position")
          .limit(3)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);
  if (!allowed) return { error: "Você chegou ao limite de descrições com IA de hoje (30). Amanhã libera de novo." };

  const content: ContentBlock[] = [
    ...images.map((img): ContentBlock => ({ type: "image", source: { type: "url", url: productImageUrl(img.path) } })),
    {
      type: "text",
      text: [
        "Dados do anúncio:",
        `Título: ${title.slice(0, 120)}`,
        `Categoria: ${category?.name ?? "não informada"}`,
        `Condição: ${conditionLabel[input.condition]}`,
        images.length ? `Fotos: ${images.length} (acima)` : "Fotos: ainda não enviadas",
      ].join("\n"),
    },
  ];
  try {
    const draft = await structured({ schema: DescriptionDraftSchema, system: DESCRIPTION_SYSTEM, content, effort: "low" });
    if (!draft) return { error: "A IA não conseguiu escrever esta descrição. Escreva você mesmo ou tente outro título." };
    return { text: draftToText(draft) };
  } catch (e) {
    return { error: aiError(e) };
  }
}

/** Busca inteligente: frase do comprador → filtros do /market. Sem IA, vira busca comum. */
export async function smartSearch(formData: FormData) {
  const q = String(formData.get("q") ?? "").trim().slice(0, 200);
  if (!q) redirect("/market");
  const plain = `/market?q=${encodeURIComponent(q.slice(0, 100))}`;
  if (!aiConfigured()) redirect(plain);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(plain)}`);
  const [{ data: allowed }, { data: categories }] = await Promise.all([
    supabase.rpc("ai_take_quota", { _feature: "search" }),
    supabase.from("categories").select("slug, name").order("position"),
  ]);
  if (!allowed) redirect(plain);
  let target = plain;
  try {
    const intent = await structured({
      schema: SearchIntentSchema,
      system: searchSystem(categories ?? []),
      content: [{ type: "text", text: `Pedido do comprador: ${q}` }],
      effort: "low",
      maxTokens: 1000,
    });
    if (intent) target = `/market?${intentToMarketParams(intent, (categories ?? []).map((c) => c.slug), q)}&ia=1`;
  } catch {
    // Sem IA agora: segue como busca comum
  }
  redirect(target);
}

/** Equipe: sugestão da IA para uma denúncia (gravada na denúncia; a decisão continua humana). */
export async function triageReport(formData: FormData) {
  const reportId = uuid.parse(formData.get("reportId"));
  const back = (msg?: string) => redirect(`/admin/denuncias${msg ? `?erro=${encodeURIComponent(msg)}` : ""}`);
  if (!aiConfigured()) back("A IA da Zexi está em configuração.");
  const supabase = await createClient();
  const { data: allowed, error: quotaError } = await supabase.rpc("ai_take_quota", { _feature: "triage" });
  if (quotaError) back("Seu papel na equipe não permite essa ação.");
  if (!allowed) back("Limite diário de análises com IA atingido.");
  const { data: report } = await supabase.from("reports").select("id, kind, target_id, reason, details").eq("id", reportId).maybeSingle();
  if (!report) back("Denúncia não encontrada.");
  const r = report!;

  const content: ContentBlock[] = [];
  let described = "Item não encontrado (pode ter sido apagado).";
  if (r.kind === "product") {
    const { data: p } = await supabase
      .from("products")
      .select("title, description, price_cents, condition, stores(name), product_images(path, position)")
      .eq("id", r.target_id)
      .maybeSingle();
    if (p) {
      for (const img of [...(p.product_images ?? [])].sort((a, b) => a.position - b.position).slice(0, 2)) {
        content.push({ type: "image", source: { type: "url", url: productImageUrl(img.path) } });
      }
      described = `Produto: ${p.title}\nLoja: ${p.stores?.name ?? "?"}\nPreço: ${formatBRLText(p.price_cents)}\nCondição: ${conditionLabel[p.condition]}\nDescrição: ${(p.description ?? "(sem descrição)").slice(0, 2000)}`;
    }
  } else if (r.kind === "video") {
    const { data: v } = await supabase.from("videos").select("caption, products(title), stores(name)").eq("id", r.target_id).maybeSingle();
    if (v) described = `Vídeo da loja ${v.stores?.name ?? "?"} sobre "${v.products?.title ?? "?"}"\nLegenda: ${v.caption ?? "(sem legenda)"}`;
  } else if (r.kind === "live") {
    const { data: l } = await supabase.from("lives").select("title, description, stores(name)").eq("id", r.target_id).maybeSingle();
    if (l) described = `Live da loja ${l.stores?.name ?? "?"}\nTítulo: ${l.title}\nDescrição: ${l.description ?? "(sem descrição)"}`;
  } else if (r.kind === "store") {
    const { data: s } = await supabase.from("stores").select("name, description").eq("id", r.target_id).maybeSingle();
    if (s) described = `Loja: ${s.name}\nSobre: ${s.description ?? "(sem descrição)"}`;
  } else {
    const { data: m } = await supabase.from("live_messages").select("body").eq("id", Number(r.target_id)).maybeSingle();
    if (m) described = `Mensagem no chat de uma live: ${m.body}`;
  }
  content.push({
    type: "text",
    text: `Denúncia\nMotivo: ${reportReasons[r.reason as ReportReason] ?? r.reason}\nDetalhes do denunciante: ${r.details ?? "(nenhum)"}\n\nConteúdo denunciado\n${described}`,
  });

  let triage;
  try {
    triage = await structured({ schema: TriageSchema, system: TRIAGE_SYSTEM, content, effort: "medium", maxTokens: 2000 });
  } catch {
    back("A IA não respondeu agora. Tente de novo.");
  }
  if (!triage) back("A IA não conseguiu analisar esta denúncia. Analise manualmente.");
  const { error } = await supabase.rpc("admin_set_report_triage", { _report_id: reportId, _triage: clampTriage(triage!) });
  revalidatePath("/admin/denuncias");
  back(error ? "Não foi possível salvar a análise." : undefined);
}
