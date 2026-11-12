import { CreditCard, Lock } from "lucide-react";
import { Notice } from "@/components/market";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { payOrder } from "@/lib/pay/actions";
import { paymentStatusLabel } from "@/lib/pay/format";
import { getOrderPayments, storeAcceptsPayments } from "@/lib/pay/queries";
import { payAvailable } from "@/lib/pay/stripe";
import type { Enums } from "@/lib/supabase/database.types";

type Props = { orderId: string; storeId: string; status: Enums<"order_status">; totalCents: number };

/** Caixa de pagamento do pedido (comprador). Dourado só no botão de pagar. */
export async function PayBox({ orderId, storeId, status, totalCents }: Props) {
  const [payments, available, accepts] = await Promise.all([
    getOrderPayments(orderId),
    payAvailable(),
    storeAcceptsPayments(storeId),
  ]);
  const last = payments[0];

  if (status !== "pending_payment") {
    const paid = payments.find((p) => p.status === "succeeded" || p.status === "refunded");
    if (!paid) return null;
    return (
      <section className="rounded-[var(--radius-card)] border border-line bg-white p-4 text-sm" aria-label="Pagamento">
        <h2 className="flex items-center gap-2 font-semibold text-navy">
          <Lock className="h-4 w-4" aria-hidden="true" /> ZEXI PAY
        </h2>
        <p className="mt-1 text-muted" data-testid="pagamento-status">
          {paymentStatusLabel[paid.status]} · {formatBRL(paid.amount_cents)}
          {paid.paid_at ? ` em ${new Date(paid.paid_at).toLocaleString("pt-BR")}` : ""}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-[var(--radius-card)] border border-line bg-white p-4 text-sm shadow-[var(--shadow-card)]" aria-label="Pagamento">
      <h2 className="flex items-center gap-2 font-semibold text-navy">
        <Lock className="h-4 w-4" aria-hidden="true" /> Pagamento seguro · ZEXI PAY
      </h2>
      {last?.status === "processing" ? (
        <Notice>Recebemos seu pedido de pagamento por Pix ou boleto. Assim que o banco confirmar, o pedido muda para “Pago”.</Notice>
      ) : !available ? (
        <Notice>O ZEXI PAY está em configuração. O pagamento online será liberado em breve.</Notice>
      ) : !accepts ? (
        <Notice>Esta loja ainda está ativando os recebimentos. Você pode pagar assim que ela concluir.</Notice>
      ) : (
        <>
          <p className="text-muted">
            Você será levado à página segura da Stripe. Cartão, Pix e boleto aparecem conforme disponíveis. O valor só vai para a
            loja depois da confirmação.
          </p>
          <form action={payOrder}>
            <input type="hidden" name="orderId" value={orderId} />
            <Button type="submit" variant="buy" size="lg" className="w-full sm:w-auto">
              <CreditCard className="h-5 w-5" aria-hidden="true" /> Pagar {formatBRL(totalCents)}
            </Button>
          </form>
        </>
      )}
    </section>
  );
}
