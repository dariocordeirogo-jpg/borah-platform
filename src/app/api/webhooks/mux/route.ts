import { followUpMux, ingestMuxEvent } from "@/lib/live/mux-webhook";

/**
 * Webhook do Mux (sinal da transmissão). O corpo vai cru para o banco, que confere a assinatura
 * (Mux-Signature) com o segredo do Vault, descarta repetidos e atualiza a live. Nada é decidido aqui.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("mux-signature");
  if (!signature) return Response.json({ error: "missing_signature" }, { status: 400 });
  const payload = await request.text();
  if (payload.length > 256 * 1024) return Response.json({ error: "payload_too_large" }, { status: 413 });

  const { data, error } = await ingestMuxEvent(payload, signature);
  if (error) {
    if (error.message.includes("invalid_signature")) return Response.json({ error: "invalid_signature" }, { status: 400 });
    // Erro do nosso lado (ou segredo ainda não configurado): o Mux tenta de novo depois
    return Response.json({ error: "temporarily_unavailable" }, { status: 500 });
  }
  try {
    await followUpMux(data);
  } catch (e) {
    // A live já saiu do ar no site; a chave será desligada no próximo aviso
    console.error("[mux-webhook] não foi possível desligar a transmissão", e instanceof Error ? e.message : e);
  }
  return Response.json({ received: true, result: data?.result ?? null });
}
