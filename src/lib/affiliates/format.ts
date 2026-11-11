/** Indique e ganhe: regras de exibição e montagem de links (sem segredo; pode ir ao navegador). */

/** Cookie que guarda o código de quem indicou (último clique vale). */
export const REF_COOKIE = "ll_ref";

export const commissionStatusLabel = {
  pending: "Aguardando pagamento",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
} as const;

export function isReferralCode(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]{4,24}$/i.test(value);
}

/**
 * Aceita "https://livelance.com.br/produto/x", "livelance.com.br/leiloes" ou "/market" e devolve só o caminho
 * interno ("/produto/x"). Links de outros sites, ou sem caminho válido, viram null.
 */
export function toInternalPath(input: string, siteUrl: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const site = new URL(siteUrl);
  let url: URL;
  try {
    if (raw.startsWith("/")) {
      if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
      url = new URL(raw, site);
    } else {
      url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    }
  } catch {
    return null;
  }
  const allowed = new Set([site.hostname, `www.${site.hostname}`, "livelance.com.br", "www.livelance.com.br"]);
  if (!allowed.has(url.hostname)) return null;
  if (url.pathname.startsWith("/r/")) return null;
  return `${url.pathname}${url.search}` || "/";
}

/** Link de indicação: /r/<código> ou /r/<código>?to=/produto/x */
export function referralLink(siteUrl: string, code: string, path: string = "/"): string {
  const base = `${siteUrl.replace(/\/$/, "")}/r/${code}`;
  return path === "/" ? base : `${base}?to=${encodeURIComponent(path)}`;
}
