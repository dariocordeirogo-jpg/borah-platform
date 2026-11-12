"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { importErrorMessage, ImportError, safeFetch } from "@/lib/importer/safe-fetch";
import { MAX_IMPORT_IMAGES, parseListing, type ImportedListing } from "@/lib/importer/parse";
import type { FormState } from "@/lib/market/actions";
import { extensionFor, sniffImageType } from "@/lib/market/image-check";
import { MAX_IMAGE_BYTES, PRODUCT_IMAGE_BUCKET } from "@/lib/market/images";
import { productSchema } from "@/lib/market/schemas";
import { createClient } from "@/lib/supabase/server";

const MAX_PAGE_BYTES = 3 * 1024 * 1024;

async function requireSeller() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?next=/seller/produtos/importar");
  const { data: store } = await supabase.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (!store) redirect("/vender");
  return { supabase, store };
}

function decode(body: Uint8Array, contentType: string): string {
  const charset = contentType.match(/charset=([\w-]+)/i)?.[1]?.toLowerCase();
  try {
    return new TextDecoder(charset && charset !== "utf8" ? charset : "utf-8").decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

export type PreviewState = { error?: string; listing?: ImportedListing };

/** Passo 1: lê o link e devolve os dados encontrados para a loja revisar. Nada é gravado aqui. */
export async function previewImport(_prev: PreviewState, formData: FormData): Promise<PreviewState> {
  await requireSeller();
  const url = String(formData.get("url") ?? "").trim();
  if (!/^https?:\/\//i.test(url)) return { error: importErrorMessage.invalid_url };
  try {
    const page = await safeFetch(url, {
      maxBytes: MAX_PAGE_BYTES,
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
      allowTypes: (t) => t === "" || t.includes("html") || t.includes("xml"),
    });
    const listing = parseListing(decode(page.body, page.contentType), page.url.toString());
    if (!listing) {
      return {
        error:
          "Não encontramos os dados do produto nessa página. Confira se é o link do anúncio (não da loja ou da busca) ou cadastre manualmente.",
      };
    }
    return { listing };
  } catch (e) {
    if (e instanceof ImportError) return { error: importErrorMessage[e.code] };
    return { error: "Não foi possível ler esse link agora. Tente de novo." };
  }
}

/** Baixa uma foto do anúncio de origem (mesma proteção) e confere a assinatura real do arquivo. */
async function fetchImage(url: string) {
  const img = await safeFetch(url, {
    maxBytes: MAX_IMAGE_BYTES,
    accept: "image/webp,image/jpeg,image/png;q=0.9",
    timeoutMs: 15_000,
    allowTypes: (t) => t === "" || t.startsWith("image/") || t === "application/octet-stream",
  });
  const type = sniffImageType(img.body);
  if (!type) throw new ImportError("bad_type");
  return { bytes: img.body, type };
}

/**
 * Passo 2: cria o produto como RASCUNHO com os dados revisados e copia as fotos escolhidas para o armazenamento da Zexi.
 * Exige a confirmação de que o anúncio é da própria loja.
 */
export async function confirmImport(_prev: FormState, formData: FormData): Promise<FormState> {
  if (formData.get("owner") !== "on") {
    return { fieldErrors: { owner: ["Confirme que o anúncio é seu (ou que você tem autorização para usar as fotos e o texto)."] } };
  }
  const sourceUrl = String(formData.get("sourceUrl") ?? "");
  if (!/^https?:\/\/\S{3,590}$/i.test(sourceUrl)) return { error: "Link de origem inválido. Comece de novo." };

  const parsed = productSchema.safeParse({ ...Object.fromEntries(formData), status: "draft" });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;
  const { supabase, store } = await requireSeller();

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      store_id: store.id,
      title: d.title,
      description: d.description,
      category_id: d.categoryId,
      condition: d.condition,
      price_cents: d.price,
      compare_at_cents: d.compareAt,
      stock: d.stock,
      weight_grams: d.weight,
      status: "draft",
      imported_from: sourceUrl,
    })
    .select("id")
    .single();
  if (error || !product) return { error: "Não foi possível criar o produto." };

  const images = [...new Set(formData.getAll("image").map(String))].filter((u) => /^https?:\/\//i.test(u)).slice(0, MAX_IMPORT_IMAGES);
  let ok = 0;
  let failed = 0;
  for (const url of images) {
    try {
      const { bytes, type } = await fetchImage(url);
      const path = `${store.id}/${product.id}/${randomUUID()}.${extensionFor[type]}`;
      const { error: upErr } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, bytes, { contentType: type, upsert: false });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("product_images").insert({ product_id: product.id, path, position: ok });
      if (dbErr) {
        await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
        throw dbErr;
      }
      ok++;
    } catch {
      failed++;
    }
  }
  revalidatePath("/seller/produtos");
  redirect(`/seller/produtos/${product.id}?importado=${ok}${failed ? `&fotos_falharam=${failed}` : ""}`);
}
