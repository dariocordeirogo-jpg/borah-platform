"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseBRLToCents } from "@/lib/market/format";
import { isShippingService } from "@/lib/shipping/format";
import { createClient } from "@/lib/supabase/server";

const ZONES = ["local", "estadual", "regional", "nacional"];

/** Equipe de operações ajusta preço e prazo de uma faixa da tabela de frete (auditado no banco). */
export async function saveShippingRate(formData: FormData) {
  const service = formData.get("service");
  const zone = String(formData.get("zone") ?? "");
  const maxGrams = Number(formData.get("maxGrams"));
  const price = parseBRLToCents(String(formData.get("price") ?? ""));
  const days = Number.parseInt(String(formData.get("days") ?? ""), 10);
  const back = (erro?: string) => {
    revalidatePath("/admin/frete");
    redirect(`/admin/frete${erro ? `?erro=${encodeURIComponent(erro)}` : "?ok=1"}`);
  };
  if (!isShippingService(service) || !ZONES.includes(zone) || !Number.isInteger(maxGrams)) back("Faixa inválida.");
  if (!price || price < 100 || !days || days < 1 || days > 60) back("Preço a partir de R$ 1,00 e prazo de 1 a 60 dias.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_shipping_rate", {
    _service: String(service),
    _zone: zone,
    _max_grams: maxGrams,
    _price_cents: price!,
    _days: days,
  });
  back(error ? (error.message.startsWith("forbidden") ? "Seu papel na equipe não permite alterar o frete." : "Não foi possível salvar.") : undefined);
}
