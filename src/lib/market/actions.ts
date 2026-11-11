"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isCouponCode, normalizeCouponCode } from "@/lib/coupons/format";
import { createClient } from "@/lib/supabase/server";
import { isReferralCode, REF_COOKIE } from "@/lib/affiliates/format";
import { marketErrorMessage } from "@/lib/market/format";
import { addressSchema } from "@/lib/market/schemas";

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined>; message?: string };

const uuid = z.uuid();

async function requireUser(next: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return { supabase, user };
}

/** Adiciona ao carrinho. Com buyNow, vai direto para o carrinho. */
export async function addToCart(formData: FormData) {
  const productId = uuid.parse(formData.get("productId"));
  const quantity = Math.min(99, Math.max(1, Number(formData.get("quantity")) || 1));
  const buyNow = formData.get("buyNow") === "1";
  const { supabase, user } = await requireUser(`/produto/${productId}`);

  const { data: existing } = await supabase
    .from("cart_items")
    .select("quantity")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("cart_items")
      .update({ quantity: Math.min(99, buyNow ? Math.max(existing.quantity, quantity) : existing.quantity + quantity) })
      .eq("user_id", user.id)
      .eq("product_id", productId);
  } else {
    await supabase.from("cart_items").insert({ user_id: user.id, product_id: productId, quantity });
  }
  revalidatePath("/", "layout");
  redirect(buyNow ? "/carrinho" : `/produto/${productId}?adicionado=1`);
}

export async function updateCartQuantity(formData: FormData) {
  const productId = uuid.parse(formData.get("productId"));
  const quantity = Number(formData.get("quantity"));
  const { supabase, user } = await requireUser("/carrinho");
  if (!Number.isInteger(quantity) || quantity < 1) {
    await supabase.from("cart_items").delete().eq("user_id", user.id).eq("product_id", productId);
  } else {
    await supabase
      .from("cart_items")
      .update({ quantity: Math.min(99, quantity) })
      .eq("user_id", user.id)
      .eq("product_id", productId);
  }
  revalidatePath("/", "layout");
}

export async function removeFromCart(formData: FormData) {
  const productId = uuid.parse(formData.get("productId"));
  const { supabase, user } = await requireUser("/carrinho");
  await supabase.from("cart_items").delete().eq("user_id", user.id).eq("product_id", productId);
  revalidatePath("/", "layout");
}

export async function saveAddress(_prev: FormState, formData: FormData): Promise<FormState> {
  const { next: _next, ...fields } = Object.fromEntries(formData);
  void _next;
  const parsed = addressSchema.safeParse(fields);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const { supabase, user } = await requireUser("/checkout");
  const { count } = await supabase.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  const { error } = await supabase
    .from("addresses")
    .insert({ ...parsed.data, user_id: user.id, label: "Entrega", is_default: !count });
  if (error) return { error: "Não foi possível salvar o endereço." };
  // Recarrega a página de origem (checkout ou arremate) para a lista de endereços incluir o novo.
  const next = formData.get("next");
  redirect(typeof next === "string" && /^\/leilao\/[0-9a-f-]{36}\/arremate$/.test(next) ? next : "/checkout");
}

export async function placeOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const addressId = uuid.safeParse(formData.get("addressId"));
  if (!addressId.success) return { error: "Escolha um endereço de entrega." };
  const { supabase } = await requireUser("/checkout");
  // Indicação (cookie do link /r/<código>): o banco decide se gera comissão
  const ref = (await cookies()).get(REF_COOKIE)?.value;
  const coupon = normalizeCouponCode(String(formData.get("coupon") ?? ""));
  if (coupon && !isCouponCode(coupon)) return { error: marketErrorMessage("coupon_invalid") };
  const { data, error } = await supabase.rpc("place_order", {
    _address_id: addressId.data,
    _ref_code: isReferralCode(ref) ? ref : null,
    _coupon_code: coupon || null,
    _shipping_service: formData.get("shippingService") === "sedex" ? "sedex" : "pac",
  });
  if (error || !data?.length) return { error: marketErrorMessage(error?.message) };
  revalidatePath("/", "layout");
  redirect(data.length === 1 ? `/conta/pedidos/${data[0]}?novo=1` : "/conta/pedidos?novo=1");
}

export async function cancelMyOrder(formData: FormData) {
  const orderId = uuid.parse(formData.get("orderId"));
  const { supabase } = await requireUser(`/conta/pedidos/${orderId}`);
  const { error } = await supabase.rpc("cancel_order", { _order_id: orderId });
  revalidatePath("/", "layout");
  redirect(`/conta/pedidos/${orderId}${error ? `?erro=${encodeURIComponent(marketErrorMessage(error.message))}` : ""}`);
}
