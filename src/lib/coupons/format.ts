/** Cupons: textos e validações que podem ir ao navegador. O banco decide o desconto de verdade. */
import { formatBRL } from "@/lib/format";

export const COUPON_CODE = /^[A-Z0-9]{3,20}$/;

export function normalizeCouponCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isCouponCode(input: string): boolean {
  return COUPON_CODE.test(normalizeCouponCode(input));
}

export type CouponLike = {
  kind: "percent" | "fixed";
  percent_off: number | null;
  amount_off_cents: number | null;
  min_subtotal_cents: number;
};

export function describeCoupon(c: CouponLike): string {
  const off = c.kind === "percent" ? `${c.percent_off}% de desconto` : `${formatBRL(c.amount_off_cents ?? 0)} de desconto`;
  return c.min_subtotal_cents > 0 ? `${off} em compras a partir de ${formatBRL(c.min_subtotal_cents)}` : off;
}

/** Mesma regra do banco (private.coupon_discount): nunca zera o pedido, sobra pelo menos R$ 1,00. */
export function couponDiscount(c: CouponLike, subtotalCents: number, shippingCents = 0): number {
  const raw = c.kind === "percent" ? Math.floor((subtotalCents * (c.percent_off ?? 0)) / 100) : (c.amount_off_cents ?? 0);
  return Math.max(0, Math.min(raw, subtotalCents, subtotalCents + shippingCents - 100));
}

export function couponErrorMessage(message: string | undefined): string | null {
  const [code, detail] = (message ?? "").split(":");
  switch (code) {
    case "coupon_invalid":
      return "Cupom inválido ou desativado.";
    case "coupon_expired":
      return "Este cupom está fora da validade.";
    case "coupon_exhausted":
      return "Este cupom já atingiu o limite de usos.";
    case "coupon_used":
      return "Você já usou este cupom.";
    case "coupon_not_applicable":
      return "Este cupom não vale para os produtos do seu carrinho.";
    case "coupon_min_subtotal":
      return `Este cupom vale para compras a partir de ${formatBRL(Number(detail) || 0)} na loja.`;
    case "coupon_code_invalid":
      return "Use de 3 a 20 letras ou números, sem espaços ou símbolos.";
    case "coupon_code_taken":
      return "Esse código já está em uso. Escolha outro.";
    case "coupon_value_invalid":
      return "Desconto inválido: de 1% a 90%, ou a partir de R$ 1,00.";
    case "coupon_dates_invalid":
      return "A validade precisa terminar no futuro e depois do início.";
    case "coupon_not_found":
      return "Cupom não encontrado.";
    case "store_required":
      return "Abra sua loja para criar cupons.";
    default:
      return null;
  }
}
