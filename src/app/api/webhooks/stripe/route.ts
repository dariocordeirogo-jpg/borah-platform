import { followUp, ingestStripeEvent } from "@/lib/pay/ingest";

/**
 * Webhook da Stripe. O corpo vai cru para o banco, que confere a assinatura com o segredo do Vault,
 * descarta repetidos e aplica a mudança numa transação. Nada é decidido aqui.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "missing_signature" }, { status: 400 });
  const payload = await request.text();
  if (payload.length > 512 * 1024) return Response.json({ error: "payload_too_large" }, { status: 413 });

  const { data, error } = await ingestStripeEvent(payload, signature);
  if (error) {
    if (error.message.includes("invalid_signature")) return Response.json({ error: "invalid_signature" }, { status: 400 });
    // Erro do nosso lado: a Stripe tenta de novo depois
    return Response.json({ error: "temporarily_unavailable" }, { status: 500 });
  }
  try {
    await followUp(data);
  } catch (e) {
    // O pagamento fica marcado com needs_refund no banco para devolução manual
    console.error("[stripe-webhook] reembolso automático falhou", e instanceof Error ? e.message : e);
  }
  return Response.json({ received: true, result: data?.result ?? null, duplicate: data?.duplicate ?? false });
}
