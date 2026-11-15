/** Avaliações e reputação: textos e regras de exibição que podem ir ao navegador. */

export type ReputationColor = "green" | "yellow" | "red";

export type Reputation = {
  sales: number;
  /** Frações de 0 a 1 das vendas do período (reclamações, cancelamentos pela loja, envios atrasados) */
  complaintRate: number | null;
  cancelRate: number | null;
  delayRate: number | null;
  answerRate: number | null;
  ratingAvg: number | null;
  ratingCount: number;
  /** Cor calculada pelo banco; null até as 5 primeiras vendas */
  color: ReputationColor | null;
};

/** Regras exibidas ao vendedor (o banco é quem calcula; valores em private.reputation_settings). */
export const REPUTATION_RULES = { minSales: 5, complaintLimit: 0.1, cancelLimit: 0.05, delayLimit: 0.2, handlingDays: 3 } as const;

export const emptyReputation: Reputation = {
  sales: 0,
  complaintRate: null,
  cancelRate: null,
  delayRate: null,
  answerRate: null,
  ratingAvg: null,
  ratingCount: 0,
  color: null,
};

export const colorLabel: Record<ReputationColor, string> = {
  green: "Reputação verde",
  yellow: "Reputação amarela",
  red: "Reputação vermelha",
};

/** "Loja nova" até as 5 primeiras vendas; depois, a cor. */
export function reputationTitle(r: Reputation): string {
  return r.color ? colorLabel[r.color] : "Loja nova";
}

/** "8%" */
export const percent = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100).toLocaleString("pt-BR")}%`);

/** "4,5" */
export const ratingText = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "+50 vendas", "+5 vendas", "12 vendas" (arredonda para baixo em faixas, como nos marketplaces). */
export function salesLabel(n: number): string {
  if (n <= 0) return "Ainda sem vendas";
  for (const step of [10000, 5000, 1000, 500, 100, 50, 10]) if (n >= step) return `+${step.toLocaleString("pt-BR")} vendas`;
  return `${n} ${n === 1 ? "venda" : "vendas"}`;
}

/** Selos da loja: só aparecem com dados suficientes e bons. */
export function reputationBadges(r: Reputation): string[] {
  const out: string[] = [];
  if (r.answerRate !== null && r.answerRate >= 0.8) out.push("Bom atendimento");
  if (r.sales >= REPUTATION_RULES.minSales && r.delayRate !== null && r.delayRate <= 0.1) out.push("Entrega no prazo");
  return out;
}

export function reviewErrorMessage(message?: string): string {
  switch ((message ?? "").split(":")[0]) {
    case "not_delivered":
      return "Você pode avaliar depois de receber o pedido.";
    case "review_window_closed":
      return "O prazo para avaliar este pedido (60 dias após a entrega) terminou.";
    case "invalid_rating":
      return "Escolha de 1 a 5 estrelas.";
    case "invalid_comment":
      return "O comentário precisa ter de 3 a 1000 caracteres.";
    case "order_not_found":
      return "Pedido não encontrado.";
    default:
      return "Não foi possível salvar a avaliação agora. Tente de novo.";
  }
}

/** Prazo para avaliar: até 60 dias depois da entrega (o banco confere de novo). */
export function reviewWindowOpen(deliveredAt: string, now = Date.now()): boolean {
  return now - new Date(deliveredAt).getTime() < 60 * 24 * 60 * 60 * 1000;
}
