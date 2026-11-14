/**
 * Acesso interno durante a construção: com SITE_ACCESS_PASSWORD definida (só no servidor/Vercel), o site inteiro
 * fica atrás da página /em-construcao. O cookie guarda um hash da senha (nunca a senha); trocar a senha
 * invalida os acessos antigos. Sem a variável (dev, testes), nada é bloqueado.
 */
export const ACCESS_COOKIE = "zexi_acesso";
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

export function siteLocked(): boolean {
  return Boolean(process.env.SITE_ACCESS_PASSWORD);
}

/** Caminhos que continuam abertos com o site fechado (página da senha, saúde, webhooks, rotinas agendadas e arquivos da marca). */
export function isOpenPath(pathname: string): boolean {
  return (
    pathname === "/em-construcao" ||
    pathname === "/api/health" ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/jobs/") ||
    pathname === "/robots.txt" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/icon.svg" ||
    pathname === "/apple-icon.png" ||
    pathname.startsWith("/opengraph-image") ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/_next/")
  );
}

export async function accessToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`zexi-acesso:${password}:${process.env.SITE_ACCESS_SECRET ?? ""}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** O cookie do visitante vale para a senha atual? */
export async function hasAccess(cookieValue: string | undefined): Promise<boolean> {
  const password = process.env.SITE_ACCESS_PASSWORD;
  if (!password) return true;
  if (!cookieValue) return false;
  return cookieValue === (await accessToken(password));
}

/** Só caminhos internos (evita redirecionar para outro site depois da senha). */
export function safeNext(next: unknown): string {
  return typeof next === "string" && /^\/(?!\/)[^\s]*$/.test(next) && !next.startsWith("/em-construcao") ? next : "/";
}
