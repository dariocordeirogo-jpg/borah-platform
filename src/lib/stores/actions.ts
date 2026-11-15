"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasContact } from "@/lib/contact/server";
import { extensionFor, sniffImageType } from "@/lib/market/image-check";
import { MAX_IMAGE_BYTES } from "@/lib/market/images";
import { requireStore } from "@/lib/market/seller-guard";
import { isStoreTheme, MAX_FEATURED, STORE_MEDIA_BUCKET, storeErrorMessage } from "@/lib/stores/format";
import { createClient } from "@/lib/supabase/server";

const back = (q: string): never => redirect(`/seller/loja?${q}#aparencia`);
const err = (msg: string): never => back(`erro=${encodeURIComponent(msg)}`);

/** Confere e envia uma imagem para a pasta da loja (assinatura real do arquivo, até 5 MB). */
async function uploadImage(storeId: string, file: FormDataEntryValue | null, kind: string): Promise<string> {
  if (!(file instanceof File) || file.size === 0) err("Escolha uma imagem.");
  const f = file as File;
  if (f.size > MAX_IMAGE_BYTES) err("A imagem passa de 5 MB.");
  const bytes = new Uint8Array(await f.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) err("Envie uma imagem JPG, PNG ou WebP.");
  const path = `${storeId}/${kind}-${randomUUID()}.${extensionFor[type!]}`;
  const supabase = await createClient();
  const { error } = await supabase.storage.from(STORE_MEDIA_BUCKET).upload(path, bytes, { contentType: type!, upsert: false });
  if (error) err("Não foi possível enviar a imagem. Tente de novo.");
  return path;
}

async function removeImage(path: string | null | undefined) {
  if (!path) return;
  const supabase = await createClient();
  await supabase.storage.from(STORE_MEDIA_BUCKET).remove([path]);
}

const refresh = (slug: string) => {
  revalidatePath(`/loja/${slug}`);
  revalidatePath("/seller/loja");
};

/** Cor da página e frase de apresentação (contato na frase é ocultado pelo banco). */
export async function saveAppearance(formData: FormData) {
  const store = await requireStore("/seller/loja");
  const theme = formData.get("theme");
  const tagline = String(formData.get("tagline") ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!isStoreTheme(theme)) err("Escolha uma cor.");
  const supabase = await createClient();
  const { error } = await supabase.from("stores").update({ theme: theme as string, tagline: tagline || null }).eq("id", store.id);
  if (error) err(storeErrorMessage());
  refresh(store.slug);
  back(`ok=aparencia${(await hasContact(supabase, tagline)) ? "&contato=1" : ""}`);
}

/** Logo ou capa: envia a nova, grava o caminho e apaga a antiga. */
export async function uploadStoreImage(formData: FormData) {
  const store = await requireStore("/seller/loja");
  const kind = formData.get("kind") === "cover" ? "cover" : "logo";
  const path = await uploadImage(store.id, formData.get("image"), kind);
  const supabase = await createClient();
  const { error } = await supabase.from("stores").update(kind === "cover" ? { cover_path: path } : { logo_path: path }).eq("id", store.id);
  if (error) {
    await removeImage(path);
    err(storeErrorMessage());
  }
  await removeImage(kind === "cover" ? store.cover_path : store.logo_path);
  refresh(store.slug);
  back(`ok=${kind}`);
}

export async function removeStoreImage(formData: FormData) {
  const store = await requireStore("/seller/loja");
  const kind = formData.get("kind") === "cover" ? "cover" : "logo";
  const supabase = await createClient();
  await supabase.from("stores").update(kind === "cover" ? { cover_path: null } : { logo_path: null }).eq("id", store.id);
  await removeImage(kind === "cover" ? store.cover_path : store.logo_path);
  refresh(store.slug);
  back("ok=removida");
}

/** Novo banner (imagem + título opcional + produto opcional da própria loja). */
export async function addBanner(formData: FormData) {
  const store = await requireStore("/seller/loja");
  const title = String(formData.get("title") ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const product = z.uuid().safeParse(formData.get("productId"));
  const path = await uploadImage(store.id, formData.get("image"), "banner");
  const supabase = await createClient();
  const { count } = await supabase.from("store_banners").select("id", { count: "exact", head: true }).eq("store_id", store.id);
  const { error } = await supabase.from("store_banners").insert({
    store_id: store.id,
    image_path: path,
    title: title || null,
    product_id: product.success ? product.data : null,
    position: count ?? 0,
  });
  if (error) {
    await removeImage(path);
    err(storeErrorMessage(error.message));
  }
  refresh(store.slug);
  back(`ok=banner${(await hasContact(supabase, title)) ? "&contato=1" : ""}`);
}

export async function deleteBanner(formData: FormData) {
  const store = await requireStore("/seller/loja");
  const id = z.coerce.number().int().positive().parse(formData.get("bannerId"));
  const supabase = await createClient();
  const { data } = await supabase.from("store_banners").delete().eq("id", id).eq("store_id", store.id).select("image_path").maybeSingle();
  await removeImage(data?.image_path);
  refresh(store.slug);
  back("ok=banner-apagado");
}

/** Produtos em destaque: substitui a lista inteira (na ordem marcada). */
export async function saveFeatured(formData: FormData) {
  const store = await requireStore("/seller/loja");
  const ids = [...new Set(formData.getAll("productId").map(String))].filter((v) => z.uuid().safeParse(v).success);
  if (ids.length > MAX_FEATURED) err(storeErrorMessage("too_many_featured"));
  const supabase = await createClient();
  await supabase.from("store_featured").delete().eq("store_id", store.id);
  if (ids.length) {
    const { error } = await supabase.from("store_featured").insert(ids.map((product_id, position) => ({ store_id: store.id, product_id, position })));
    if (error) err(storeErrorMessage(error.message));
  }
  refresh(store.slug);
  back("ok=destaques");
}
