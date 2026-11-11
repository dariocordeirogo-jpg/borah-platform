"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { brasiliaLocalToISO } from "@/lib/auctions/schemas";
import { isPlaybackUrl, liveErrorMessage } from "@/lib/live/format";
import { parseBRLToCents } from "@/lib/market/format";
import { createClient } from "@/lib/supabase/server";

const uuid = z.uuid();
export type LiveFormState = { error?: string };

function studio(liveId: string, error?: string) {
  return `/seller/lives/${liveId}${error ? `?erro=${encodeURIComponent(error)}` : ""}`;
}

export async function createLive(_prev: LiveFormState, formData: FormData): Promise<LiveFormState> {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const when = brasiliaLocalToISO(String(formData.get("scheduledAt") ?? ""));
  const productIds = formData.getAll("productIds").map(String).filter((v) => uuid.safeParse(v).success);
  if (title.length < 3 || title.length > 120) return { error: "Dê um título de 3 a 120 caracteres." };
  if (!when) return { error: "Escolha data e hora de início." };
  if (!productIds.length) return { error: liveErrorMessage("products_required") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_live", {
    _title: title,
    _description: description || null,
    _scheduled_at: when,
    _product_ids: productIds,
  });
  if (error || !data) return { error: liveErrorMessage(error?.message) };
  revalidatePath("/ao-vivo");
  redirect(`/seller/lives/${data}?nova=1`);
}

export async function setPlayback(formData: FormData) {
  const liveId = uuid.parse(formData.get("liveId"));
  const url = String(formData.get("playbackUrl") ?? "").trim();
  if (url && !isPlaybackUrl(url)) redirect(studio(liveId, liveErrorMessage("invalid_url")));
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_live_playback", { _live_id: liveId, _url: url || null });
  redirect(studio(liveId, error ? liveErrorMessage(error.message) : undefined));
}

export async function startLive(formData: FormData) {
  const liveId = uuid.parse(formData.get("liveId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_live", { _live_id: liveId });
  revalidatePath("/ao-vivo");
  redirect(studio(liveId, error ? liveErrorMessage(error.message) : undefined));
}

export async function endLive(formData: FormData) {
  const liveId = uuid.parse(formData.get("liveId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_live", { _live_id: liveId });
  revalidatePath("/ao-vivo");
  redirect(studio(liveId, error ? liveErrorMessage(error.message) : undefined));
}

export async function pinProduct(formData: FormData) {
  const liveId = uuid.parse(formData.get("liveId"));
  const raw = formData.get("productId");
  const productId = raw ? uuid.parse(raw) : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("pin_live_product", { _live_id: liveId, _product_id: productId });
  redirect(studio(liveId, error ? liveErrorMessage(error.message) : undefined));
}

export async function startLiveAuction(formData: FormData) {
  const liveId = uuid.parse(formData.get("liveId"));
  const productId = uuid.parse(formData.get("productId"));
  const starting = parseBRLToCents(String(formData.get("starting") ?? ""));
  const increment = parseBRLToCents(String(formData.get("increment") ?? ""));
  const minutes = Number(formData.get("minutes"));
  if (!starting || starting < 100) redirect(studio(liveId, "Lance inicial mínimo de R$ 1,00."));
  if (!increment || increment < 100) redirect(studio(liveId, "Incremento mínimo de R$ 1,00."));
  if (![5, 10, 15].includes(minutes)) redirect(studio(liveId, liveErrorMessage("invalid_duration")));
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_live_auction", {
    _live_id: liveId,
    _product_id: productId,
    _starting_cents: starting,
    _increment_cents: increment,
    _minutes: minutes,
  });
  redirect(studio(liveId, error ? liveErrorMessage(error.message) : undefined));
}

export async function sendMessage(liveId: string, body: string): Promise<{ error?: string }> {
  if (!uuid.safeParse(liveId).success) return { error: liveErrorMessage() };
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_live_message", { _live_id: liveId, _body: body.slice(0, 400) });
  return error ? { error: liveErrorMessage(error.message) } : {};
}

export async function hideMessage(messageId: number): Promise<{ error?: string }> {
  if (!Number.isSafeInteger(messageId)) return { error: liveErrorMessage() };
  const supabase = await createClient();
  const { error } = await supabase.rpc("hide_live_message", { _message_id: messageId });
  return error ? { error: liveErrorMessage(error.message) } : {};
}
