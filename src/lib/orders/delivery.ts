/** Entregas: transportadoras aceitas, rótulos e etapas da linha do tempo (sem segredo; pode ir ao navegador). */

export const carriers = {
  correios: { label: "Correios", site: "https://rastreamento.correios.com.br/app/index.php" },
  jadlog: { label: "Jadlog", site: "https://www.jadlog.com.br/jadlog/home" },
  loggi: { label: "Loggi", site: "https://www.loggi.com/rastreador/" },
  jt: { label: "J&T Express", site: "https://www.jtexpress.com.br/" },
  total_express: { label: "Total Express", site: "https://tracking.totalexpress.com.br/" },
  azul_cargo: { label: "Azul Cargo Express", site: "https://www.azulcargoexpress.com.br/" },
  propria: { label: "Entrega própria da loja", site: null },
  outra: { label: "Outra transportadora", site: null },
} as const;

export type Carrier = keyof typeof carriers;
export const carrierKeys = Object.keys(carriers) as Carrier[];
export const isCarrier = (v: unknown): v is Carrier => typeof v === "string" && v in carriers;

/** Mesma regra do banco: letras maiúsculas, números e hífen, 4 a 40 caracteres (espaços são removidos). */
export function normalizeTrackingCode(raw: string): string | null {
  const code = raw.replace(/\s/g, "").toUpperCase();
  return /^[A-Z0-9-]{4,40}$/.test(code) ? code : null;
}

export type OrderEvent = { kind: string; detail: unknown; created_at: string };

export const timelineSteps = [
  { key: "created", label: "Compra feita" },
  { key: "paid", label: "Pagamento aprovado" },
  { key: "shipped", label: "A caminho" },
  { key: "delivered", label: "Entregue" },
] as const;

/** Data de cada etapa a partir dos eventos (a primeira ocorrência vale). */
export function stepDates(events: OrderEvent[]): Partial<Record<(typeof timelineSteps)[number]["key"], string>> {
  const out: Partial<Record<string, string>> = {};
  for (const e of [...events].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (!out[e.kind]) out[e.kind] = e.created_at;
  }
  return out;
}

export function deliveryErrorMessage(message: string | undefined): string {
  const code = (message ?? "").split(":")[0];
  switch (code) {
    case "invalid_carrier":
      return "Escolha a transportadora.";
    case "invalid_tracking_code":
      return "Código de rastreio inválido. Use só letras e números (ex.: AA123456789BR).";
    case "order_not_shippable":
      return "Este pedido não pode ser marcado como enviado (precisa estar pago).";
    case "order_not_in_transit":
      return "Este pedido não está a caminho.";
    case "order_not_found":
      return "Pedido não encontrado.";
    default:
      return "Não foi possível concluir agora. Tente de novo.";
  }
}

export const dateBR = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short" }) : "";
export const dateTimeBR = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";
