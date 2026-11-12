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

/** Recorte da conta Accounts v2 que interessa para a situação da loja. */
export type V2AccountSnapshot = {
  id: string;
  livemode: boolean;
  metadata?: Record<string, string> | null;
  configuration?: {
    merchant?: {
      capabilities?: {
        card_payments?: { status?: string } | null;
        stripe_balance?: { payouts?: { status?: string } | null } | null;
      } | null;
    } | null;
  } | null;
  requirements?: {
    entries?: Array<{ awaiting_action_from?: string; description?: string; minimum_deadline?: { status?: string } | null }> | null;
  } | null;
};

/**
 * Converte a conta v2 para o formato que o banco recebe no aviso account.updated.
 * Situação pela capacidade v2: vender = card_payments ativo; receber = payouts ativo.
 * Pendências = o que a loja precisa enviar agora (vencido ou a vencer).
 */
export function accountStatusFromV2(a: V2AccountSnapshot) {
  const caps = a.configuration?.merchant?.capabilities;
  const due = (a.requirements?.entries ?? [])
    .filter((e) => e.awaiting_action_from === "user" && ["currently_due", "past_due"].includes(e.minimum_deadline?.status ?? ""))
    .map((e) => e.description ?? "")
    .filter(Boolean);
  return {
    id: a.id,
    object: "account",
    livemode: a.livemode,
    metadata: a.metadata ?? {},
    charges_enabled: caps?.card_payments?.status === "active",
    payouts_enabled: caps?.stripe_balance?.payouts?.status === "active",
    details_submitted: due.length === 0,
    requirements: { currently_due: due },
  };
}

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
