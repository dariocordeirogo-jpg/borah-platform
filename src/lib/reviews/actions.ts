"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { reviewErrorMessage } from "@/lib/reviews/format";
import { createClient } from "@/lib/supabase/server";
import { hasContact } from "@/lib/contact/server";

export type ReviewState = { error?: string; ok?: boolean; contactHidden?: boolean };
const uuid = z.uuid();

export async function reviewProduct(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const orderId = uuid.safeParse(formData.get("orderId"));
  const productId = uuid.safeParse(formData.get("productId"));
  const rating = Number(formData.get("rating"));
  if (!orderId.success || !productId.success) return { error: reviewErrorMessage() };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: reviewErrorMessage("invalid_rating") };
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 1100);
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_product", {
    _order_id: orderId.data,
    _product_id: productId.data,
    _rating: rating,
    _comment: comment || null,
  });
  if (error) return { error: reviewErrorMessage(error.message) };
  revalidatePath(`/conta/pedidos/${orderId.data}`);
  revalidatePath(`/produto/${productId.data}`);
  return { ok: true, contactHidden: await hasContact(supabase, comment) };
}
