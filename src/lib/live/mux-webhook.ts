import "server-only";
import { createAnonClient } from "@/lib/supabase/anon";
import { disableMuxStream, muxConfigured } from "@/lib/live/mux";
import { signStripePayload } from "@/lib/pay/signature";

export type MuxIngestResult = { result?: string; action?: "disable"; stream_id?: string; duplicate?: boolean };

/** Entrega o aviso (já assinado) ao banco, que confere a assinatura e aplica a mudança. */
export async function ingestMuxEvent(payload: string, signature: string) {
  const { data, error } = await createAnonClient().rpc("mux_ingest_event", { _payload: payload, _signature: signature });
  return { data: (data ?? null) as MuxIngestResult | null, error };
}

/**
 * O banco pediu para desligar a chave de uma live que já saiu do ar. Depois de desligar no Mux,
 * o servidor avisa o banco com um aviso interno assinado com o mesmo segredo do webhook (o Mux usa o
 * mesmo formato t=..,v1=.. da Stripe).
 */
export async function followUpMux(res: MuxIngestResult | null) {
  if (res?.action !== "disable" || !res.stream_id || !muxConfigured()) return;
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret || !/^[A-Za-z0-9]{10,100}$/.test(res.stream_id)) return;
  await disableMuxStream(res.stream_id);
  const payload = JSON.stringify({ id: `zexi_disable_${res.stream_id}`, type: "zexi.stream_disabled", data: { id: res.stream_id } });
  await ingestMuxEvent(payload, signStripePayload(payload, secret));
}
