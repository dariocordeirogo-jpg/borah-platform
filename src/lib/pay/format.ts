/** Textos e regras de exibição do ZEXI PAY (sem segredo; pode ir ao navegador). */

/** Modo da chave Stripe pelo prefixo: teste ou produção. Outros formatos não são aceitos. */
export function stripeKeyMode(key: string | undefined): "test" | "live" | null {
  if (!key) return null;
  if (/^(sk|rk)_live_/.test(key)) return "live";
  if (/^(sk|rk)_test_/.test(key)) return "test";
  return null;
}

export const paymentStatusLabel = {
  created: "Aguardando pagamento",
  processing: "Processando (Pix/boleto)",
  succeeded: "Pago",
  failed: "Não concluído",
  expired: "Expirado",
  refunded: "Reembolsado",
} as const;

export type PaymentStatus = keyof typeof paymentStatusLabel;

/** 1000 → "10%"; 1250 → "12,5%" */
export function bpsToPercent(bps: number): string {
  const v = bps / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(2).replace(/0+$/, "").replace(".", ",")}%`;
}

/** Só para pré-visualização; o valor que vale é calculado no banco. */
export function previewFee(amountCents: number, bps: number): number {
  return Math.round((amountCents * bps) / 10000);
}

export type PayoutAccount = {
  verified: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements_due: string[];
} | null;

export type PayoutState = "none" | "pending" | "restricted" | "active";

/** Situação da conta de recebimento da loja. */
export function payoutState(a: PayoutAccount): PayoutState {
  if (!a) return "none";
  if (!a.verified || !a.details_submitted) return "pending";
  if (!a.charges_enabled || !a.payouts_enabled || a.requirements_due.length > 0) return "restricted";
  return "active";
}

export const payoutStateLabel: Record<PayoutState, string> = {
  none: "Não conectada",
  pending: "Cadastro em andamento",
  restricted: "Pendências na Stripe",
  active: "Recebimentos ativos",
};

/** Traduz erros das funções de pagamento do banco e da integração. */
export function payErrorMessage(message: string | undefined): string {
  const code = (message ?? "").split(":")[0];
  switch (code) {
    case "store_cannot_receive":
      return "Esta loja ainda está ativando os recebimentos. Tente mais tarde.";
    case "order_not_payable":
      return "Este pedido não aceita mais pagamento.";
    case "payment_processing":
      return "Já existe um pagamento em processamento (Pix ou boleto). Aguarde a confirmação.";
    case "order_not_found":
      return "Pedido não encontrado.";
    case "store_required":
      return "Crie sua loja antes de conectar os recebimentos.";
    case "not_authenticated":
      return "Entre na sua conta para continuar.";
    case "pay_unavailable":
      return "O ZEXI PAY está em configuração. O pagamento online será liberado em breve.";
    case "stripe_error":
      return "A Stripe não respondeu agora. Tente de novo em instantes.";
    default:
      return "Não foi possível concluir agora. Tente de novo.";
  }
}
