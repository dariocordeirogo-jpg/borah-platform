"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { brasiliaLocalToISO } from "@/lib/auctions/schemas";
import { couponErrorMessage, isCouponCode, normalizeCouponCode } from "@/lib/coupons/format";
import { formatBRL } from "@/lib/format";
import { parseBRLToCents } from "@/lib/market/format";
import { createClient } from "@/lib/supabase/server";

export type CouponFormState = { error?: string };
const uuid = z.uuid();
const fail = (message?: string) => couponErrorMessage(message) ?? "Não foi possível salvar o cupom. Tente de novo.";

/** Loja cria um cupom. O banco valida tudo de novo (código único, valor, datas, dono). */
export async function createCoupon(_prev: CouponFormState, formData: FormData): Promise<CouponFormState> {
  const code = normalizeCouponCode(String(formData.get("code") ?? ""));
  if (!isCouponCode(code)) return { error: fail("coupon_code_invalid") };
  const kind = formData.get("kind") === "fixed" ? "fixed" : "percent";
  const rawValue = String(formData.get("value") ?? "");
  const value = kind === "percent" ? Number.parseInt(rawValue, 10) : parseBRLToCents(rawValue);
  if (!value || (kind === "percent" && (value < 1 || value > 90)) || (kind === "fixed" && value < 100)) {
    return { error: fail("coupon_value_invalid") };
  }
  const minRaw = String(formData.get("minSubtotal") ?? "").trim();
  const min = minRaw ? parseBRLToCents(minRaw) : 0;
  if (min === null) return { error: "Valor mínimo inválido." };
  const maxRaw = String(formData.get("maxUses") ?? "").trim();
  const maxUses = maxRaw ? Number.parseInt(maxRaw, 10) : null;
  if (maxRaw && (!maxUses || maxUses < 1)) return { error: "Limite de usos inválido." };
  const endsRaw = String(formData.get("endsAt") ?? "").trim();
  const endsAt = endsRaw ? brasiliaLocalToISO(endsRaw) : null;
  if (endsRaw && !endsAt) return { error: fail("coupon_dates_invalid") };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_coupon", {
    _code: code,
    _kind: kind,
    _value: value,
    _min_subtotal_cents: min,
    _max_uses: maxUses,
    _ends_at: endsAt,
  });
  if (error) return { error: fail(error.message) };
  revalidatePath("/seller/cupons");
  redirect("/seller/cupons?ok=1");
}

export async function toggleCoupon(formData: FormData) {
  const id = uuid.parse(formData.get("couponId"));
  const active = formData.get("active") === "1";
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_coupon_active", { _coupon_id: id, _active: active });
  revalidatePath("/seller/cupons");
  redirect(`/seller/cupons${error ? `?erro=${encodeURIComponent(fail(error.message))}` : ""}`);
}

/** Checkout: prévia do cupom digitado (o desconto final é decidido pelo banco ao fechar o pedido). */
export async function previewCoupon(code: string): Promise<{ ok?: string; error?: string }> {
  const c = normalizeCouponCode(code);
  if (!isCouponCode(c)) return { error: fail("coupon_invalid") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_coupon", { _code: c });
  if (error || !data) return { error: couponErrorMessage(error?.message) ?? "Não foi possível conferir o cupom agora." };
  const d = data as { store_name: string; discount_cents: number };
  return { ok: `Cupom ${c}: ${formatBRL(d.discount_cents)} de desconto nos produtos de ${d.store_name}.` };
}
