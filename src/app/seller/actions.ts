"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizeCep } from "@/lib/shipping/format";
import { createClient } from "@/lib/supabase/server";
import { marketErrorMessage } from "@/lib/market/format";
import { extensionFor, sniffImageType } from "@/lib/market/image-check";
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_PRODUCT, PRODUCT_IMAGE_BUCKET } from "@/lib/market/images";
import { productSchema, storeSchema } from "@/lib/market/schemas";
import type { FormState } from "@/lib/market/actions";

const uuid = z.uuid();

async function requireSeller() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?next=/seller");
  const { data: store } = await supabase.from("stores").select("id, slug").eq("owner_id", user.id).maybeSingle();
  if (!store) redirect("/vender");
  return { supabase, user, store };
}

export async function createStore(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = storeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?next=/vender");
  const { error } = await supabase.rpc("create_store", {
    _name: parsed.data.name,
    _slug: parsed.data.slug,
    _description: parsed.data.description ?? undefined,
  });
  if (error) {
    const msg = marketErrorMessage(error.message);
    return msg.includes("endereço de loja") ? { fieldErrors: { slug: [msg] } } : { error: msg };
  }
  revalidatePath("/", "layout");
  redirect("/seller?bemvindo=1");
}

export async function updateStore(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = storeSchema.omit({ slug: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const rawCep = String(formData.get("originCep") ?? "").trim();
  const originCep = rawCep ? normalizeCep(rawCep) : null;
  if (rawCep && !originCep) return { fieldErrors: { originCep: ["CEP inválido. Use 8 números, ex.: 01001-000."] } };
  const { supabase, store } = await requireSeller();
  const { error } = await supabase
    .from("stores")
    .update({ name: parsed.data.name, description: parsed.data.description, origin_cep: originCep })
    .eq("id", store.id);
  if (error) return { error: "Não foi possível salvar." };
  revalidatePath("/", "layout");
  return { message: "Loja atualizada." };
}

/** Cria (sem id) ou atualiza (com id) um produto da própria loja. */
export async function saveProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const { supabase, store } = await requireSeller();
  const id = formData.get("id");
  const d = parsed.data;
  const values = {
    title: d.title,
    description: d.description,
    category_id: d.categoryId,
    condition: d.condition,
    price_cents: d.price,
    compare_at_cents: d.compareAt,
    stock: d.stock,
    weight_grams: d.weight,
    status: d.status,
    video_url: d.video,
  };

  if (typeof id === "string" && id) {
    const productId = uuid.parse(id);
    const { error } = await supabase.from("products").update(values).eq("id", productId).eq("store_id", store.id);
    if (error) return { error: "Não foi possível salvar o produto." };
    revalidatePath("/", "layout");
    return { message: "Produto salvo." };
  }

  const { data, error } = await supabase
    .from("products")
    .insert({ ...values, store_id: store.id })
    .select("id")
    .single();
  if (error || !data) return { error: "Não foi possível criar o produto." };
  revalidatePath("/", "layout");
  redirect(`/seller/produtos/${data.id}?criado=1`);
}

export async function uploadProductImages(_prev: FormState, formData: FormData): Promise<FormState> {
  const productId = uuid.parse(formData.get("productId"));
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Escolha pelo menos uma foto." };
  const { supabase, store } = await requireSeller();

  const { data: product } = await supabase
    .from("products")
    .select("id, product_images(position)")
    .eq("id", productId)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!product) return { error: "Produto não encontrado." };

  const existing = product.product_images.length;
  if (existing + files.length > MAX_IMAGES_PER_PRODUCT) {
    return { error: `Cada produto pode ter até ${MAX_IMAGES_PER_PRODUCT} fotos.` };
  }

  let position = existing ? Math.max(...product.product_images.map((i) => i.position)) + 1 : 0;
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) return { error: `"${file.name}" passa de 5 MB.` };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImageType(bytes);
    if (!type) return { error: `"${file.name}" não é JPG, PNG ou WebP.` };
    const path = `${store.id}/${productId}/${randomUUID()}.${extensionFor[type]}`;
    const { error: upErr } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(path, bytes, { contentType: type, upsert: false });
    if (upErr) return { error: "Falha ao enviar a foto. Tente de novo." };
    const { error: dbErr } = await supabase.from("product_images").insert({ product_id: productId, path, position: position++ });
    if (dbErr) {
      await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
      return { error: "Falha ao registrar a foto." };
    }
  }
  revalidatePath("/", "layout");
  return { message: files.length === 1 ? "Foto enviada." : `${files.length} fotos enviadas.` };
}

export async function deleteProductImage(formData: FormData) {
  const imageId = uuid.parse(formData.get("imageId"));
  const productId = uuid.parse(formData.get("productId"));
  const { supabase, store } = await requireSeller();
  const { data: img } = await supabase
    .from("product_images")
    .select("id, path, products!inner(store_id)")
    .eq("id", imageId)
    .eq("products.store_id", store.id)
    .maybeSingle();
  if (img) {
    await supabase.from("product_images").delete().eq("id", imageId);
    await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([img.path]);
  }
  revalidatePath("/", "layout");
  redirect(`/seller/produtos/${productId}`);
}

export async function cancelStoreOrder(formData: FormData) {
  const orderId = uuid.parse(formData.get("orderId"));
  const { supabase } = await requireSeller();
  const { error } = await supabase.rpc("cancel_order", { _order_id: orderId, _reason: "Cancelado pela loja" });
  revalidatePath("/", "layout");
  redirect(`/seller/pedidos${error ? `?erro=${encodeURIComponent(marketErrorMessage(error.message))}` : ""}`);
}
