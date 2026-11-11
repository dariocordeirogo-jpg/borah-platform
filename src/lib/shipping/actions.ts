"use server";

import { z } from "zod";
import { marketErrorMessage } from "@/lib/market/format";
import type { ShippingQuote } from "@/lib/shipping/format";
import { createClient } from "@/lib/supabase/server";

/** Checkout: opções de frete (PAC/SEDEX) por loja do carrinho para o endereço escolhido. */
export async function quoteShipping(addressId: string): Promise<{ quotes?: ShippingQuote[]; error?: string }> {
  if (!z.uuid().safeParse(addressId).success) return { error: "Escolha um endereço de entrega." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quote_cart_shipping", { _address_id: addressId });
  if (error) return { error: marketErrorMessage(error.message) };
  return { quotes: (data as ShippingQuote[] | null) ?? [] };
}
