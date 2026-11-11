import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderStatus } from "@/components/order-status";
import { formatBRL } from "@/lib/format";
import { getRecentOrders } from "@/lib/admin/queries";
import { paymentStatusLabel } from "@/lib/pay/format";

export const metadata: Metadata = { title: "Pedidos", robots: { index: false } };

async function Orders() {
  const orders = await getRecentOrders();
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Pedidos recentes</h1>
      <p className="text-sm text-muted">
        “A devolver”: pagamento que precisa de reembolso (pedido cancelado ou valor diferente). O servidor tenta devolver sozinho; se
        falhar, a devolução é manual no painel da Stripe.
      </p>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-left text-xs text-muted">
            <tr>
              <th className="p-3 font-semibold">Pedido</th>
              <th className="p-3 font-semibold">Loja</th>
              <th className="p-3 font-semibold">Data</th>
              <th className="p-3 font-semibold">Situação</th>
              <th className="p-3 font-semibold">Pagamento</th>
              <th className="p-3 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => {
              const pay = [...(o.payments ?? [])].pop();
              const refund = (o.payments ?? []).some((p) => p.needs_refund);
              return (
                <tr key={o.id}>
                  <td className="p-3 font-medium text-navy">#{o.number}</td>
                  <td className="p-3">{o.stores?.name}</td>
                  <td className="p-3 text-muted">{new Date(o.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3">
                    <OrderStatus status={o.status} />
                  </td>
                  <td className="p-3">
                    {pay ? paymentStatusLabel[pay.status] : "—"}
                    {refund && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-danger">A devolver</span>}
                  </td>
                  <td className="p-3 text-right font-semibold text-navy">{formatBRL(o.total_cents)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
      <Orders />
    </Suspense>
  );
}
