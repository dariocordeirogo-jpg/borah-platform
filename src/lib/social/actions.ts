"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isSocialPlatform, normalizeHandle, socialErrorMessage } from "@/lib/social/format";
import { createClient } from "@/lib/supabase/server";

const uuid = z.uuid();
const back = (path: string, error?: string) => `${path}${error ? `?erro=${encodeURIComponent(error)}` : ""}`;

/** Conta: gera o código de vínculo (vale 30 min). Quem comentar o código na live com o próprio @ fica vinculado. */
export async function newLinkCode(): Promise<{ code?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_social_link");
  return error || !data ? { error: socialErrorMessage(error?.message) } : { code: data };
}

export async function unlinkSocial(formData: FormData) {
  const platform = formData.get("platform");
  if (!isSocialPlatform(platform)) redirect("/conta/redes");
  const supabase = await createClient();
  const { error } = await supabase.rpc("unlink_social", { _platform: platform });
  revalidatePath("/conta/redes");
  redirect(back("/conta/redes", error ? socialErrorMessage(error.message) : undefined));
}

/** Estúdio: liga a live aos perfis da loja no TikTok e no Instagram (vazio desliga). */
export async function setLiveSocial(formData: FormData) {
  const liveId = uuid.parse(formData.get("liveId"));
  const studio = `/seller/lives/${liveId}`;
  const supabase = await createClient();
  for (const platform of ["tiktok", "instagram"] as const) {
    const handle = normalizeHandle(String(formData.get(platform) ?? ""));
    if (handle === undefined) redirect(back(studio, socialErrorMessage("invalid_social_username")));
    const { error } = await supabase.rpc("set_live_social", { _live_id: liveId, _platform: platform, _username: handle ?? "" });
    if (error) redirect(back(studio, socialErrorMessage(error.message)));
  }
  revalidatePath(studio);
  redirect(studio);
}
