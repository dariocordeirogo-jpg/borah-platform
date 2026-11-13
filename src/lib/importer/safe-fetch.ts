import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isBlockedIp } from "@/lib/importer/ip";

/**
 * Busca de páginas e fotos de terceiros com proteção contra SSRF (usar o servidor da Zexi para acessar a rede interna):
 * só http/https nas portas padrão, sem usuário/senha na URL, todos os IPs do domínio precisam ser públicos,
 * redirecionamentos conferidos um a um, tempo e tamanho limitados.
 */

export class ImportError extends Error {
  constructor(public code: "invalid_url" | "blocked_host" | "unreachable" | "http_error" | "too_large" | "bad_type" | "timeout", public status?: number) {
    super(code);
  }
}

const MAX_REDIRECTS = 4;
const UA = "Mozilla/5.0 (compatible; ZexiImporter/1.0; +https://www.zexi.com.br)";

/** Só para os testes automáticos (servidor de exemplo em 127.0.0.1). Nunca definir em produção. */
const loopbackAllowed = () => process.env.ZEXI_IMPORT_ALLOW_LOOPBACK === "1";
const isLoopback = (ip: string) => ip === "::1" || ip.startsWith("127.");

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ImportError("invalid_url");
  if (url.username || url.password) throw new ImportError("invalid_url");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) throw new ImportError("invalid_url");

  let addresses: string[];
  if (isIP(host)) addresses = [host];
  else {
    if (host === "localhost" || /\.(localhost|local|internal|lan|home|corp)$/.test(host)) {
      if (!loopbackAllowed()) throw new ImportError("blocked_host");
    }
    try {
      addresses = (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);
    } catch {
      throw new ImportError("unreachable");
    }
  }
  if (!addresses.length) throw new ImportError("unreachable");
  const testLoopback = loopbackAllowed() && addresses.every(isLoopback);
  if (!testLoopback) {
    if (url.port && url.port !== "80" && url.port !== "443") throw new ImportError("blocked_host");
    if (addresses.some(isBlockedIp)) throw new ImportError("blocked_host");
  }
}

export type Fetched = { url: URL; contentType: string; body: Uint8Array };

export async function safeFetch(
  raw: string,
  opts: { maxBytes: number; accept: string; timeoutMs?: number; allowTypes: (contentType: string) => boolean },
): Promise<Fetched> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ImportError("invalid_url");
  }
  const deadline = AbortSignal.timeout(opts.timeoutMs ?? 10_000);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: deadline,
        headers: { accept: opts.accept, "user-agent": UA, "accept-language": "pt-BR,pt;q=0.9" },
        cache: "no-store",
      });
    } catch (e) {
      throw new ImportError(e instanceof Error && e.name === "TimeoutError" ? "timeout" : "unreachable");
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel();
      if (!loc) throw new ImportError("http_error", res.status);
      url = new URL(loc, url);
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new ImportError("http_error", res.status);
    }
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!opts.allowTypes(contentType)) {
      await res.body?.cancel();
      throw new ImportError("bad_type");
    }
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > opts.maxBytes) {
      await res.body?.cancel();
      throw new ImportError("too_large");
    }
    const reader = res.body?.getReader();
    if (!reader) return { url, contentType, body: new Uint8Array() };
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > opts.maxBytes) {
        await reader.cancel();
        throw new ImportError("too_large");
      }
      chunks.push(value);
    }
    const body = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      body.set(c, off);
      off += c.byteLength;
    }
    return { url, contentType, body };
  }
  throw new ImportError("http_error", 310);
}

export const importErrorMessage: Record<ImportError["code"], string> = {
  invalid_url: "Cole o link completo do anúncio (começando com https://).",
  blocked_host: "Esse endereço não pode ser importado.",
  unreachable: "Não conseguimos acessar esse site. Confira o link.",
  http_error: "O site não abriu a página do anúncio (ele pode bloquear leituras automáticas).",
  too_large: "A página ou a foto é grande demais para importar.",
  bad_type: "Esse link não é uma página de anúncio.",
  timeout: "O site demorou demais para responder. Tente de novo.",
};
