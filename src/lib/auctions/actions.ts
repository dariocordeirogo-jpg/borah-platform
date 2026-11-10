"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auctionErrorMessage } from "@/lib/auctions/format";
import { auctionSchema, verificationSchema } from "@/lib/auctions/schemas";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; fieldErrors?: Record<string, string[] | undefined>; message?: string };
export type BidResult = { ok: true; currentCents: number; endsAt: string; extended: boolean } | { ok: false; error: string };

const uuid = z.uuid();

async function client(next: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return supabase;
}

export async function submitVerification(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = verificationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await client("/conta/verificacao");
  const { error } = await supabase.rpc("submit_verification", { _cpf: parsed.data.cpf, _phone: parsed.data.phone });
  if (error) {
    const msg = auctionErrorMessage(error.message);
    if (error.message.startsWith("cpf")) return { fieldErrors: { cpf: [msg] } };
    if (error.message.startsWith("phone")) return { fieldErrors: { phone: [msg] } };
    return { error: msg };
  }
  revalidatePath("/", "layout");
  const next = formData.get("next");
  if (typeof next === "string" && next.startsWith("/leilao/")) redirect(next);
  return { message: "Pronto! Você já pode dar lances." };
}

/** Lance: a decisão (valor mínimo, horário, anti-sniping) é toda do banco. */
export async function placeBid(auctionId: string, amountCents: number, idempotencyKey: string): Promise<BidResult> {
  if (!uuid.safeParse(auctionId).success || !Number.isInteger(amountCents) || !/^[\w-]{8,64}$/.test(idempotencyKey)) {
    return { ok: false, error: "Lance inválido." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: auctionErrorMessage("not_authenticated") };
  const { data, error } = await supabase.rpc("place_bid", {
    _auction_id: auctionId,
    _amount_cents: amountCents,
    _idempotency_key: idempotencyKey,
  });
  if (error) return { ok: false, error: auctionErrorMessage(error.message) };
  const r = data as { current_price_cents: number; ends_at: string; extended?: boolean };
  return { ok: true, currentCents: r.current_price_cents, endsAt: r.ends_at, extended: !!r.extended };
}

export async function createAuction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = auctionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await client("/seller/leiloes/novo");
  const d = parsed.data;
  const { data, error } = await supabase.rpc("create_auction", {
    _product_id: d.productId,
    _starting_cents: d.startingPrice,
    _increment_cents: d.increment,
    _reserve_cents: d.reserve,
    _starts_at: d.startsAtISO,
    _duration_minutes: d.duration,
  });
  if (error || !data) return { error: auctionErrorMessage(error?.message) };
  revalidatePath("/", "layout");
  redirect(`/leilao/${data}?criado=1`);
}

export async function cancelAuction(formData: FormData) {
  const id = uuid.parse(formData.get("auctionId"));
  const supabase = await client("/seller/leiloes");
  const { error } = await supabase.rpc("cancel_auction", { _auction_id: id });
  revalidatePath("/", "layout");
  redirect(`/seller/leiloes${error ? `?erro=${encodeURIComponent(auctionErrorMessage(error.message))}` : ""}`);
}

export async function confirmWin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auctionId = uuid.safeParse(formData.get("auctionId"));
  const addressId = uuid.safeParse(formData.get("addressId"));
  if (!auctionId.success) return { error: "Leilão inválido." };
  if (!addressId.success) return { error: auctionErrorMessage("address_not_found") };
  const supabase = await client(`/leilao/${auctionId.data}`);
  const { data, error } = await supabase.rpc("confirm_auction_win", { _auction_id: auctionId.data, _address_id: addressId.data });
  if (error || !data) return { error: auctionErrorMessage(error?.message) };
  revalidatePath("/", "layout");
  redirect(`/conta/pedidos/${data}?novo=1`);
}
