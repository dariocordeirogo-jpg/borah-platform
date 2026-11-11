import "server-only";

/**
 * Serviço de transmissão das lives: Mux (só no servidor).
 * Sem MUX_TOKEN_ID / MUX_TOKEN_SECRET a transmissão aparece "em configuração" e a loja pode colar um link HLS.
 * A chave de transmissão (stream key) é segredo da loja: nunca vai para o banco nem para quem assiste.
 */
const API = "https://api.mux.com/video/v1";

/** Endereço do servidor para OBS / app de celular (RTMPS). */
export const MUX_RTMP_URL = "rtmps://global-live.mux.com:443/app";

export type MuxStreamStatus = "idle" | "active" | "disabled";
export type MuxStream = {
  id: string;
  stream_key: string;
  status: MuxStreamStatus;
  playback_ids?: { id: string; policy: string }[];
};

export function muxConfigured(): boolean {
  return Boolean(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET);
}

export class MuxError extends Error {
  constructor(readonly status: number) {
    super(`mux_${status}`);
  }
}

async function mux<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const auth = Buffer.from(`${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`).toString("base64");
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new MuxError(res.status);
  if (res.status === 204) return undefined as T;
  const json = (await res.json()) as { data: T };
  return json.data;
}

/** Pedido de criação: reprodução pública, baixa latência e até 4 h contínuas (sem gravação, para não gerar custo extra). */
export function newStreamRequest(liveId: string) {
  return {
    playback_policy: ["public"],
    latency_mode: "low",
    reconnect_window: 60,
    max_continuous_duration: 4 * 60 * 60,
    passthrough: liveId,
  };
}

export function publicPlaybackId(stream: Pick<MuxStream, "playback_ids">): string | null {
  return stream.playback_ids?.find((p) => p.policy === "public")?.id ?? null;
}

export function createMuxStream(liveId: string) {
  return mux<MuxStream>("/live-streams", { method: "POST", body: newStreamRequest(liveId) });
}

export function getMuxStream(streamId: string) {
  return mux<MuxStream>(`/live-streams/${encodeURIComponent(streamId)}`);
}

/** Desliga a transmissão: a chave deixa de aceitar vídeo (a live terminou). */
export function disableMuxStream(streamId: string) {
  return mux<unknown>(`/live-streams/${encodeURIComponent(streamId)}/disable`, { method: "PUT" });
}
