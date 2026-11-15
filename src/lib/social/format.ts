/** Ponte com TikTok e Instagram: textos e validações que podem ir ao navegador. */

export const socialPlatforms = ["tiktok", "instagram"] as const;
export type SocialPlatform = (typeof socialPlatforms)[number];

export const platformLabel: Record<SocialPlatform, string> = { tiktok: "TikTok", instagram: "Instagram" };

export function isSocialPlatform(v: unknown): v is SocialPlatform {
  return v === "tiktok" || v === "instagram";
}

/** "@Loja.Oficial " → "loja.oficial"; vazio → null; fora do formato → undefined. */
export function normalizeHandle(raw: string): string | null | undefined {
  const v = raw.trim().replace(/^@+/, "").toLowerCase();
  if (!v) return null;
  return /^[a-z0-9._]{1,30}$/.test(v) ? v : undefined;
}

/** Resultado de cada comando, como aparece no espelho da live. */
export const socialResultLabel: Record<string, string> = {
  linked: "conta vinculada",
  invalid_code: "código inválido ou vencido",
  ok: "lance aceito",
  in_cart: "foi para o carrinho",
  not_linked: "vincule sua conta em zexi.com.br/conta/redes",
  no_auction: "sem leilão agora",
  no_product: "sem produto em destaque",
  auction_running: "leilão em andamento: dê lance",
  out_of_stock: "esgotado",
  own_product: "produto da própria loja",
  invalid_amount: "valor inválido (ex.: lance 150)",
  verification_required: "confirme CPF e celular na Zexi",
  bid_too_low: "abaixo do lance mínimo",
  bid_too_high: "acima do limite",
  already_leading: "você já lidera",
  auction_closed: "leilão encerrado",
  bid_blocked: "lances bloqueados",
  auction_banned: "fora deste lote",
  own_auction: "leilão da própria loja",
};

export function socialErrorMessage(message?: string): string {
  switch ((message ?? "").split(":")[0]) {
    case "invalid_social_username":
      return "Use o @ do perfil (letras, números, ponto e sublinhado; até 30).";
    case "too_many_codes":
      return "Muitos códigos hoje. Tente de novo amanhã.";
    case "live_finished":
      return "Esta transmissão já terminou.";
    case "not_authenticated":
      return "Entre na sua conta para continuar.";
    default:
      return "Não foi possível concluir agora. Tente de novo.";
  }
}
