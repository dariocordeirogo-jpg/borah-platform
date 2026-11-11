import { couponErrorMessage } from "@/lib/coupons/format";
/**
 * Converte o preço digitado ("1.299,90", "1299.9", "R$ 49") em centavos inteiros.
 * Devolve null quando não é um valor válido.
 */
export function parseBRLToCents(input: string): number | null {
  const raw = input.replace(/\s|R\$/g, "");
  if (!raw) return null;
  let normalized: string;
  if (raw.includes(",")) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    normalized = raw.replace(/\./g, "");
  } else {
    normalized = raw;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Centavos → texto editável no formato brasileiro ("1299,90"). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** "Fone Bluetooth Ação!" → "fone-bluetooth-acao" */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

export const conditionLabel = { new: "Novo", used: "Usado", refurbished: "Recondicionado" } as const;
export const productStatusLabel = { draft: "Rascunho", active: "Ativo", paused: "Pausado" } as const;
export const orderStatusLabel = {
  pending_payment: "Aguardando pagamento",
  paid: "Pago",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
} as const;

/** Traduz os erros levantados pelas funções do banco (checkout, cancel_order, create_store). */
export function marketErrorMessage(message: string | undefined): string {
  const coupon = couponErrorMessage(message);
  if (coupon) return coupon;
  const [code, detail] = (message ?? "").split(":");
  switch (code) {
    case "insufficient_stock":
      return `Estoque insuficiente para "${detail}". Ajuste a quantidade no carrinho.`;
    case "product_unavailable":
      return `"${detail}" não está mais disponível. Remova do carrinho para continuar.`;
    case "own_product":
      return `Você não pode comprar um produto da sua própria loja ("${detail}").`;
    case "cart_empty":
      return "Seu carrinho está vazio.";
    case "address_not_found":
      return "Escolha um endereço de entrega.";
    case "order_not_cancellable":
      return "Este pedido não pode mais ser cancelado.";
    case "payment_processing":
      return "Há um pagamento por Pix ou boleto em processamento. Aguarde a confirmação antes de cancelar.";
    case "order_not_found":
      return "Pedido não encontrado.";
    case "store_exists":
      return "Você já tem uma loja.";
    case "not_authenticated":
      return "Entre na sua conta para continuar.";
    default:
      if (message?.includes("stores_slug_key")) return "Esse endereço de loja já está em uso. Escolha outro.";
      return "Não foi possível concluir agora. Tente de novo.";
  }
}
