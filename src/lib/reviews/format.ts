/** Avaliações e reputação: textos e regras de exibição que podem ir ao navegador. */

export type Reputation = {
  sales: number;
  onTimeRate: number | null;
  answerRate: number | null;
  ratingAvg: number | null;
  ratingCount: number;
  level: number | null;
};

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
  if (r.onTimeRate !== null && r.onTimeRate >= 0.85) out.push("Entrega no prazo");
  return out;
}

export const levelLabel: Record<number, string> = {
  1: "Reputação baixa",
  2: "Reputação regular",
  3: "Boa reputação",
  4: "Ótima reputação",
  5: "Excelente reputação",
};

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
    case "contact_not_allowed":
      return "Não é permitido colocar telefone, e-mail, links ou redes sociais na avaliação.";
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
