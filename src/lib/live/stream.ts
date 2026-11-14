import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { cloudflareConfigured, deleteCfInput } from "@/lib/live/cloudflare";
import { disableMuxStream, muxConfigured } from "@/lib/live/mux";

/**
 * Depois que a live termina (pela loja ou pela moderação), desliga a transmissão (Mux) ou apaga a entrada
 * do navegador (Cloudflare) para não aceitar mais vídeo. Falha aqui não desfaz o encerramento.
 */
export async function retireLiveStream(supabase: SupabaseClient<Database>, liveId: string): Promise<void> {
  if (!muxConfigured() && !cloudflareConfigured()) return;
  const { data } = await supabase.rpc("live_stream_ref", { _live_id: liveId });
  const ref = data?.[0];
  if (!ref || ref.disabled_at) return;
  const cloudflare = ref.provider === "cloudflare";
  if (cloudflare ? !cloudflareConfigured() : !muxConfigured()) return;
  try {
    if (cloudflare) await deleteCfInput(ref.stream_id);
    else await disableMuxStream(ref.stream_id);
    await supabase.rpc("mark_live_stream_disabled", { _live_id: liveId });
  } catch (e) {
    console.error(cloudflare ? "cloudflare: não foi possível apagar a entrada" : "mux: não foi possível desligar a transmissão", liveId, e);
  }
}
