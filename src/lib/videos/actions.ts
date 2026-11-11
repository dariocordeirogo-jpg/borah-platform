"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { VIDEO_BUCKET, videoErrorMessage } from "@/lib/videos/format";

const uuid = z.uuid();
const createSchema = z.object({
  productId: z.uuid(),
  path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(mp4|webm|mov)$/),
  caption: z.string().trim().max(300).optional(),
});

/** Registra o vídeo já enviado ao Storage. Loja, produto e arquivo são conferidos no banco. */
export async function createVideo(input: { productId: string; path: string; caption?: string }): Promise<{ error?: string }> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: "Confira o produto e o arquivo." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_video", {
    _product_id: parsed.data.productId,
    _path: parsed.data.path,
    _caption: parsed.data.caption || null,
  });
  if (error) {
    // Não deixa arquivo órfão no Storage
    await supabase.storage.from(VIDEO_BUCKET).remove([parsed.data.path]);
    return { error: videoErrorMessage(error.message) };
  }
  revalidatePath("/videos");
  revalidatePath("/seller/videos");
  return {};
}

export async function removeVideo(formData: FormData) {
  const videoId = uuid.parse(formData.get("videoId"));
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("remove_video", { _video_id: videoId });
  if (error || !path) redirect(`/seller/videos?erro=${encodeURIComponent(videoErrorMessage(error?.message))}`);
  await supabase.storage.from(VIDEO_BUCKET).remove([path]);
  revalidatePath("/videos");
  redirect("/seller/videos");
}

export async function toggleLike(videoId: string): Promise<{ liked: boolean; likes: number } | { error: "login" | "failed" }> {
  if (!uuid.safeParse(videoId).success) return { error: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("toggle_video_like", { _video_id: videoId });
  if (error) return { error: error.message.includes("not_authenticated") ? "login" : "failed" };
  return data as { liked: boolean; likes: number };
}

export async function registerView(videoId: string): Promise<void> {
  if (!uuid.safeParse(videoId).success) return;
  const supabase = await createClient();
  await supabase.rpc("register_video_view", { _video_id: videoId });
}
