"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deliveryErrorMessage, isCarrier, normalizeTrackingCode } from "@/lib/orders/delivery";
import { createClient } from "@/lib/supabase/server";

const uuid = z.uuid();
const back = (path: unknown, fallback: string) =>
  typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? path : fallback;
const withParam = (path: string, key: string, value: string) => `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;

/** Loja informa o envio (ou corrige o código). Quem decide se pode é o banco (ship_order). */
export async function shipOrder(formData: FormData) {
  const orderId = uuid.parse(formData.get("orderId"));
  const next = back(formData.get("next"), "/seller/pedidos");
  const carrier = formData.get("carrier");
  const code = normalizeTrackingCode(String(formData.get("trackingCode") ?? ""));
  if (!isCarrier(carrier)) redirect(withParam(next, "erro", deliveryErrorMessage("invalid_carrier")));
  if (!code) redirect(withParam(next, "erro", deliveryErrorMessage("invalid_tracking_code")));
  const supabase = await createClient();
  const { error } = await supabase.rpc("ship_order", { _order_id: orderId, _carrier: carrier, _tracking_code: code });
  if (error) redirect(withParam(next, "erro", deliveryErrorMessage(error.message)));
  revalidatePath("/seller/pedidos");
  revalidatePath(`/conta/pedidos/${orderId}`);
  redirect(withParam(next, "ok", "Envio registrado. O comprador já pode acompanhar a entrega."));
}

/** Comprador confirma que recebeu o pedido. */
export async function confirmDelivery(formData: FormData) {
  const orderId = uuid.parse(formData.get("orderId"));
  const next = back(formData.get("next"), `/conta/pedidos/${orderId}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_delivery", { _order_id: orderId });
  if (error) redirect(withParam(next, "erro", deliveryErrorMessage(error.message)));
  revalidatePath("/conta/pedidos");
  redirect(withParam(next, "recebido", "1"));
}
