/** Reclamações do comprador: textos e regras de exibição que podem ir ao navegador. */

export const COMPLAINT_REASONS = ["not_received", "not_as_described", "damaged", "other"] as const;
export type ComplaintReason = (typeof COMPLAINT_REASONS)[number];

export const reasonLabel: Record<ComplaintReason, string> = {
  not_received: "Não recebi o produto",
  not_as_described: "Diferente do anúncio",
  damaged: "Chegou com defeito ou danificado",
  other: "Outro problema",
};

export const isReason = (v: unknown): v is ComplaintReason => COMPLAINT_REASONS.includes(v as ComplaintReason);

export type Complaint = {
  id: number;
  order_id: string;
  reason: ComplaintReason;
  details: string | null;
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
};

/** Dá para reclamar: pedido pago, enviado ou entregue há menos de 30 dias (o banco confere de novo). */
export function complaintWindowOpen(status: string, deliveredAt: string | null, now = Date.now()): boolean {
  if (status === "paid" || status === "shipped") return true;
  if (status !== "delivered") return false;
  return !deliveredAt || now - new Date(deliveredAt).getTime() < 30 * 24 * 60 * 60 * 1000;
}

export function complaintErrorMessage(message?: string): string {
  switch ((message ?? "").split(":")[0]) {
    case "complaint_exists":
      return "Você já abriu uma reclamação para este pedido.";
    case "complaint_window_closed":
      return "O prazo para reclamar (30 dias após a entrega) terminou.";
    case "order_not_complainable":
      return "Só dá para reclamar de pedidos pagos.";
    case "invalid_reason":
      return "Escolha o motivo da reclamação.";
    case "invalid_details":
      return "Conte o problema em até 1000 caracteres.";
    case "order_not_found":
    case "complaint_not_found":
      return "Pedido não encontrado.";
    default:
      return "Não foi possível registrar agora. Tente de novo.";
  }
}
