/** Frete: textos e regras que podem ir ao navegador. O valor cobrado é decidido no banco (tabela região × peso). */

export type ShippingService = "pac" | "sedex";
export const shippingServiceLabel: Record<ShippingService, string> = { pac: "PAC", sedex: "SEDEX" };
export const shippingZoneLabel = {
  local: "Local (mesma cidade/região do CEP)",
  estadual: "Mesmo estado",
  regional: "Mesma região do país",
  nacional: "Outras regiões",
} as const;

export function isShippingService(v: unknown): v is ShippingService {
  return v === "pac" || v === "sedex";
}

export function formatDays(days: number): string {
  return days === 1 ? "1 dia útil" : `${days} dias úteis`;
}

export function formatWeight(grams: number): string {
  if (grams < 1000) return `${grams} g`;
  const kg = grams / 1000;
  return `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;
}

/** "01001-000" / "01001000" → "01001000"; inválido → null. */
export function normalizeCep(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return /^\d{8}$/.test(digits) && digits !== "00000000" ? digits : null;
}

export function formatCep(cep: string): string {
  return cep.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

export type ShippingQuote = {
  store_id: string;
  store_name: string;
  grams: number;
  pac: { price_cents: number; days: number } | null;
  sedex: { price_cents: number; days: number } | null;
};

/** Soma do frete escolhido em todas as lojas (lojas sem CEP de origem: a combinar, não somam). */
export function shippingTotal(quotes: ShippingQuote[], service: ShippingService): number {
  return quotes.reduce((s, q) => s + (q[service]?.price_cents ?? 0), 0);
}

export function shippingErrorMessage(message: string | undefined): string | null {
  switch ((message ?? "").split(":")[0]) {
    case "shipping_too_heavy":
      return "Os produtos de uma das lojas passam de 30 kg, o limite dos Correios. Divida em mais de um pedido.";
    case "shipping_cep_invalid":
      return "CEP do endereço de entrega inválido. Confira o endereço.";
    case "shipping_unavailable":
      return "Não encontramos frete para esse peso e destino.";
    case "shipping_service_invalid":
      return "Escolha PAC ou SEDEX.";
    default:
      return null;
  }
}
