import type { Metadata } from "next";
import { Suspense } from "react";
import { cancelStoreOrder } from "@/app/seller/actions";
import { EmptyState, Notice } from "@/components/market";
import { OrderStatus } from "@/components/order-status";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { getSellerOrders } from "@/lib/market/queries";
import { requireStore } from "@/lib/market/seller-guard";

export const metadata: Metadata = { title: "Pedidos" };
type Addr = { recipient: string; city: string; state: string };

async function Orders({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const [store, sp] = await Promise.all([requireStore("/seller/pedidos"), searchParams]);
  const orders = await getSellerOrders(store.id);
  return (
    <div className="space-y-3">
      {sp.erro && <Notice tone="error">{sp.erro}</Notice>}
      {!orders.length ? (
        <EmptyState title="Nenhum pedido ainda">Quando alguém comprar da sua loja, o pedido aparece aqui.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const a = o.shipping_address as unknown as Addr;
            return (
              <li key={o.id} className="rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-navy">
                    Pedido #{o.number} <span className="font-normal text-muted">· {new Date(o.created_at).toLocaleString("pt-BR")}</span>
                  </p>
                  <OrderStatus status={o.status} />
                </div>
                <ul className="mt-2 text-sm text-ink">
                  {o.order_items.map((i, idx) => (
                    <li key={idx}>
                      {i.quantity}× {i.title} — {formatBRL(i.unit_price_cents * i.quantity)}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-sm text-muted">
                  Para {a.recipient} · {a.city}/{a.state}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="font-bold text-navy">
                    {formatBRL(o.total_cents)}
                    {o.coupon_code && <span className="ml-2 text-xs font-normal text-muted">cupom {o.coupon_code}</span>}
                  </p>
                  {o.status === "pending_payment" && (
                    <form action={cancelStoreOrder}>
                      <input type="hidden" name="orderId" value={o.id} />
                      <Button type="submit" variant="outline" size="sm">
                        Cancelar pedido
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/seller/pedidos">) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Pedidos</h1>
      <Notice>Pedidos pagos pelo LIVELANCE PAY mudam sozinhos para “Pago”. Veja valores e comissão em Pagamentos.</Notice>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Orders searchParams={searchParams as Promise<{ erro?: string }>} />
      </Suspense>
    </div>
  );
}
