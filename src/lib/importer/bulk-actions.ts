"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { priceToCents } from "@/lib/importer/parse";
import { importErrorMessage, ImportError } from "@/lib/importer/safe-fetch";
import { readListing, saveImages } from "@/lib/importer/save";
import { MAX_BULK_IMAGES } from "@/lib/importer/sheet";
import { centsToInput } from "@/lib/market/format";
import { productSchema } from "@/lib/market/schemas";
import { createClient } from "@/lib/supabase/server";

/** Por chamada (o navegador manda em lotes e mostra o progresso): evita estourar o tempo da função. */
const ROWS_PER_CALL = 5;
const LINKS_PER_CALL = 3;

export type BulkResult = { title: string; ok: boolean; productId?: string; photos?: number; error?: string };

const rowSchema = z.object({
  title: z.string().max(400),
  description: z.string().max(20000),
  price: z.string().max(40),
  compareAt: z.string().max(40),
  stock: z.string().max(20),
  sku: z.string().max(100),
  condition: z.enum(["new", "used", "refurbished"]),
  weight: z.string().max(20),
  brand: z.string().max(100),
  images: z.array(z.string().max(1000)).max(20),
  link: z.string().max(600),
});
const batchSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  owner: z.literal(true),
  rows: z.array(rowSchema).min(1).max(ROWS_PER_CALL),
});

async function seller() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: store } = await supabase.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  return store ? { supabase, store } : null;
}

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Dados inválidos.";
const isHttp = (u: string) => /^https?:\/\/\S{3,590}$/i.test(u);

/** Já importado antes (mesmo link de origem nesta loja)? Evita duplicar ao repetir a planilha. */
async function alreadyImported(s: NonNullable<Awaited<ReturnType<typeof seller>>>, link: string) {
  if (!link) return false;
  const { count } = await s.supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", s.store.id).eq("imported_from", link);
  return (count ?? 0) > 0;
}

async function createDraft(
  s: NonNullable<Awaited<ReturnType<typeof seller>>>,
  categoryId: number,
  r: { title: string; description: string; priceCents: number | null; compareAtCents: number | null; stock: string; condition: "new" | "used" | "refurbished"; weight: string; link: string; images: string[] },
): Promise<BulkResult> {
  const title = r.title.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!r.priceCents) return { title, ok: false, error: "Sem preço em reais." };
  if (r.link && (await alreadyImported(s, r.link))) return { title, ok: false, error: "Já importado antes." };
  const stockDigits = r.stock.replace(/[^\d]/g, "");
  const weightDigits = r.weight.replace(/[^\d]/g, "");
  const parsed = productSchema.safeParse({
    title,
    description: r.description.slice(0, 5000),
    categoryId,
    condition: r.condition,
    price: centsToInput(r.priceCents),
    compareAt: r.compareAtCents && r.compareAtCents > r.priceCents ? centsToInput(r.compareAtCents) : "",
    stock: stockDigits ? String(Math.min(Number(stockDigits), 100000)) : "1",
    weight: weightDigits || "",
    status: "draft",
  });
  if (!parsed.success) return { title, ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  const { data: product, error } = await s.supabase
    .from("products")
    .insert({
      store_id: s.store.id,
      title: d.title,
      description: d.description,
      category_id: d.categoryId,
      condition: d.condition,
      price_cents: d.price,
      compare_at_cents: d.compareAt,
      stock: d.stock,
      weight_grams: d.weight,
      status: "draft",
      imported_from: r.link && isHttp(r.link) ? r.link : null,
    })
    .select("id")
    .single();
  if (error || !product) return { title, ok: false, error: "Não foi possível criar o produto." };
  const urls = [...new Set(r.images.filter(isHttp))].slice(0, MAX_BULK_IMAGES);
  const { ok } = await saveImages(s.supabase, s.store.id, product.id, urls);
  return { title: d.title, ok: true, productId: product.id, photos: ok };
}

/** Planilha: cria cada linha como RASCUNHO (preço, estoque e fotos revisados de novo aqui no servidor). */
export async function importSheetRows(input: unknown): Promise<{ error?: string; results?: BulkResult[] }> {
  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) return { error: "Confirme que os anúncios são seus e escolha a categoria." };
  const s = await seller();
  if (!s) return { error: "Entre com a conta da loja para importar." };
  const { categoryId, rows } = parsed.data;
  const results: BulkResult[] = [];
  for (const row of rows) {
    const extra = [row.brand && `Marca: ${row.brand}`, row.sku && `Código: ${row.sku}`].filter(Boolean).join("\n");
    results.push(
      await createDraft(s, categoryId, {
        title: row.title,
        description: [row.description.replace(/<[^>]+>/g, " ").replace(/\s{3,}/g, "\n\n").trim(), extra].filter(Boolean).join("\n\n"),
        priceCents: priceToCents(row.price),
        compareAtCents: priceToCents(row.compareAt),
        stock: row.stock,
        condition: row.condition,
        weight: row.weight,
        link: row.link,
        images: row.images,
      }),
    );
  }
  revalidatePath("/seller/produtos");
  return { results };
}

const linksSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  owner: z.literal(true),
  urls: z.array(z.string().trim().url().max(600)).min(1).max(LINKS_PER_CALL),
});

/** Vários links: lê cada anúncio (mesma leitura do importar um link) e cria como RASCUNHO. */
export async function importLinks(input: unknown): Promise<{ error?: string; results?: BulkResult[] }> {
  const parsed = linksSchema.safeParse(input);
  if (!parsed.success) return { error: "Confirme que os anúncios são seus, escolha a categoria e use links válidos." };
  const s = await seller();
  if (!s) return { error: "Entre com a conta da loja para importar." };
  const results: BulkResult[] = [];
  for (const url of parsed.data.urls) {
    try {
      const l = await readListing(url);
      if (!l) {
        results.push({ title: url, ok: false, error: "A página não traz os dados do produto." });
        continue;
      }
      results.push(
        await createDraft(s, parsed.data.categoryId, {
          title: l.title,
          description: l.description ?? "",
          priceCents: l.priceCents,
          compareAtCents: l.compareAtCents,
          stock: "1",
          condition: l.condition,
          weight: "",
          link: l.sourceUrl,
          images: l.images,
        }),
      );
    } catch (e) {
      results.push({ title: url, ok: false, error: e instanceof ImportError ? importErrorMessage[e.code] : "Não foi possível ler esse link." });
    }
  }
  revalidatePath("/seller/produtos");
  return { results };
}
