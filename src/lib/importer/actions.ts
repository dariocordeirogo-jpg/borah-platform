"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { importErrorMessage, ImportError } from "@/lib/importer/safe-fetch";
import { readListing, saveImages } from "@/lib/importer/save";
import { MAX_IMPORT_IMAGES, type ImportedListing } from "@/lib/importer/parse";
import type { FormState } from "@/lib/market/actions";
import { productSchema } from "@/lib/market/schemas";
import { createClient } from "@/lib/supabase/server";

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

export type PreviewState = { error?: string; listing?: ImportedListing };

/** Passo 1: lê o link e devolve os dados encontrados para a loja revisar. Nada é gravado aqui. */
export async function previewImport(_prev: PreviewState, formData: FormData): Promise<PreviewState> {
  await requireSeller();
  const url = String(formData.get("url") ?? "").trim();
  if (!/^https?:\/\//i.test(url)) return { error: importErrorMessage.invalid_url };
  try {
    const listing = await readListing(url);
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
  const { ok, failed } = await saveImages(supabase, store.id, product.id, images);
  revalidatePath("/seller/produtos");
  redirect(`/seller/produtos/${product.id}?importado=${ok}${failed ? `&fotos_falharam=${failed}` : ""}`);
}
