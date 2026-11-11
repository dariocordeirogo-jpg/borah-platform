import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { disableMuxStream, muxConfigured } from "@/lib/live/mux";

/**
 * Depois que a live termina (pela loja ou pela moderação), desliga a transmissão no Mux para a chave
 * não aceitar mais vídeo. Falha aqui não desfaz o encerramento: a live já saiu do ar no site.
 */
export async function retireLiveStream(supabase: SupabaseClient<Database>, liveId: string): Promise<void> {
  if (!muxConfigured()) return;
  const { data } = await supabase.rpc("live_stream_ref", { _live_id: liveId });
  const ref = data?.[0];
  if (!ref || ref.disabled_at) return;
  try {
    await disableMuxStream(ref.stream_id);
    await supabase.rpc("mark_live_stream_disabled", { _live_id: liveId });
  } catch (e) {
    console.error("mux: não foi possível desligar a transmissão", liveId, e);
  }
}
