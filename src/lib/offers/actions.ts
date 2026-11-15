"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseBRLToCents } from "@/lib/market/format";
import { flashDealErrorMessage } from "@/lib/offers/format";
import { createClient } from "@/lib/supabase/server";

const back = (q: string) => redirect(`/seller/ofertas?${q}`);

/** "2026-11-20T14:00" no horário de Brasília → ISO em UTC (null = começar agora). */
function brasiliaToIso(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function createFlashDeal(formData: FormData) {
  const productId = z.uuid().safeParse(formData.get("productId"));
  const price = parseBRLToCents(String(formData.get("price") ?? ""));
  const hours = Number(formData.get("hours"));
  const when = String(formData.get("startsAt") ?? "").trim();
  if (!productId.success) back(`erro=${encodeURIComponent("Escolha o produto.")}`);
  if (!price) back(`erro=${encodeURIComponent("Informe o preço da oferta.")}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_flash_deal", {
    _product_id: productId.data!,
    _deal_price_cents: price!,
    _starts_at: when ? brasiliaToIso(when) : null,
    _hours: Number.isInteger(hours) ? hours : 0,
  });
  if (error) back(`erro=${encodeURIComponent(flashDealErrorMessage(error.message))}`);
  revalidatePath("/ofertas");
  revalidatePath("/seller/ofertas");
  back("ok=1");
}

export async function cancelFlashDeal(formData: FormData) {
  const id = z.coerce.number().int().positive().parse(formData.get("dealId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_flash_deal", { _deal_id: id });
  revalidatePath("/ofertas");
  revalidatePath("/seller/ofertas");
  back(error ? `erro=${encodeURIComponent(flashDealErrorMessage(error.message))}` : "encerrada=1");
}
