import "server-only";

/**
 * Transmissão pelo navegador: Cloudflare Stream com WebRTC (só no servidor).
 * A loja envia a câmera por WHIP (endereço secreto, buscado na hora e mostrado só ao dono);
 * quem assiste recebe por WHEP (endereço público, gravado como link de reprodução da live).
 * Sem CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID a opção não aparece no estúdio.
 */
const API = "https://api.cloudflare.com/client/v4";

export type CfLiveInput = {
  uid: string;
  webRTC?: { url?: string };
  webRTCPlayback?: { url?: string };
};

export function cloudflareConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID);
}

export class CloudflareError extends Error {
  constructor(readonly status: number) {
    super(`cloudflare_${status}`);
  }
}

async function cf<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const account = encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID ?? "");
  const res = await fetch(`${API}/accounts/${account}/stream${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new CloudflareError(res.status);
  const text = await res.text();
  if (!text) return undefined as T;
  const json = JSON.parse(text) as { success?: boolean; result?: T };
  if (json.success === false) throw new CloudflareError(502);
  return json.result as T;
}

/** Pedido de criação: sem gravação (WebRTC ainda não grava) e com o id da live para achar a entrada depois. */
export function newInputRequest(liveId: string) {
  return { meta: { name: `Zexi live ${liveId}`, liveId }, recording: { mode: "off" } };
}

const PLAY = /^https:\/\/customer-[a-z0-9]{8,40}\.cloudflarestream\.com\/([a-f0-9]{32})\/webRTC\/play$/;
const PUBLISH = /^https:\/\/customer-[a-z0-9]{8,40}\.cloudflarestream\.com\/[A-Za-z0-9]{32,128}\/webRTC\/publish$/;

/** Link público de reprodução (WHEP) da entrada, se vier no formato esperado. */
export function playUrl(input: CfLiveInput): string | null {
  const url = input.webRTCPlayback?.url ?? "";
  const m = url.match(PLAY);
  return m && m[1] === input.uid ? url : null;
}

/** Endereço de envio (WHIP): segredo da loja. Só é devolvido se vier no formato esperado. */
export function publishUrl(input: CfLiveInput): string | null {
  const url = input.webRTC?.url ?? "";
  return PUBLISH.test(url) ? url : null;
}

export function createCfInput(liveId: string) {
  return cf<CfLiveInput>("/live_inputs", { method: "POST", body: newInputRequest(liveId) });
}

export function getCfInput(uid: string) {
  return cf<CfLiveInput>(`/live_inputs/${encodeURIComponent(uid)}`);
}

/** Apaga a entrada: o endereço de envio deixa de aceitar vídeo (a live terminou). */
export function deleteCfInput(uid: string) {
  return cf<unknown>(`/live_inputs/${encodeURIComponent(uid)}`, { method: "DELETE" });
}
