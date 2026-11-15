"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { complaintErrorMessage, isReason } from "@/lib/complaints/format";
import { hasContact } from "@/lib/contact/server";
import { createClient } from "@/lib/supabase/server";

export type ComplaintState = { error?: string; ok?: boolean; contactHidden?: boolean };
const uuid = z.uuid();

/** Comprador abre uma reclamação do pedido (o banco valida prazo, dono e duplicidade). */
export async function openComplaint(_prev: ComplaintState, formData: FormData): Promise<ComplaintState> {
  const orderId = uuid.safeParse(formData.get("orderId"));
  const reason = formData.get("reason");
  if (!orderId.success) return { error: complaintErrorMessage() };
  if (!isReason(reason)) return { error: complaintErrorMessage("invalid_reason") };
  const details = String(formData.get("details") ?? "").trim().slice(0, 1100);
  const supabase = await createClient();
  const { error } = await supabase.rpc("open_complaint", { _order_id: orderId.data, _reason: reason, _details: details || null });
  if (error) return { error: complaintErrorMessage(error.message) };
  revalidatePath(`/conta/pedidos/${orderId.data}`);
  revalidatePath("/seller/pedidos");
  return { ok: true, contactHidden: await hasContact(supabase, details) };
}

/** Comprador marca a reclamação como resolvida. */
export async function resolveComplaint(formData: FormData) {
  const orderId = uuid.parse(formData.get("orderId"));
  const complaintId = z.coerce.number().int().positive().parse(formData.get("complaintId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_complaint", { _complaint_id: complaintId });
  revalidatePath("/seller/pedidos");
  redirect(`/conta/pedidos/${orderId}?${error ? `erro=${encodeURIComponent(complaintErrorMessage(error.message))}` : "resolvida=1"}`);
}
