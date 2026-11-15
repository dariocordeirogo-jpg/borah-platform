/** Ofertas: abas, textos e contagem regressiva (podem ir ao navegador). */

export const OFFER_TABS = [
  { key: "todas", label: "Todas as ofertas" },
  { key: "relampago", label: "Ofertas relâmpago" },
  { key: "30-off", label: "30% ou mais" },
  { key: "ate-50", label: "Até R$ 50" },
] as const;
export type OfferTab = (typeof OFFER_TABS)[number]["key"];
export const isOfferTab = (v: unknown): v is OfferTab => OFFER_TABS.some((t) => t.key === v);

/** "02:15:09" até o fim (ou "Encerrada"). */
export function countdown(endsAt: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
  if (s === 0) return "Encerrada";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

export function flashDealErrorMessage(message?: string): string {
  switch ((message ?? "").split(":")[0]) {
    case "invalid_deal_price":
      return "O preço da oferta precisa ser pelo menos 5% menor que o preço atual.";
    case "invalid_duration":
      return "A oferta relâmpago dura de 1 a 24 horas.";
    case "invalid_start":
      return "Agende para começar em até 7 dias.";
    case "deal_exists":
      return "Este produto já tem uma oferta relâmpago agendada ou ativa.";
    case "product_not_active":
      return "Só produtos à venda (ativos) podem entrar em oferta.";
    case "product_not_found":
    case "deal_not_found":
      return "Produto não encontrado.";
    default:
      return "Não foi possível salvar a oferta agora. Tente de novo.";
  }
}
