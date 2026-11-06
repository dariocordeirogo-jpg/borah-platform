import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, Notice } from "@/components/market";
import { OrderStatus } from "@/components/order-status";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { getMyOrders } from "@/lib/market/queries";

export const metadata: Metadata = { title: "Meus pedidos", robots: { index: false } };

async function Orders({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  if (!(await getCurrentUser())) redirect("/entrar?next=/conta/pedidos");
  const [orders, sp] = await Promise.all([getMyOrders(), searchParams]);
  return (
    <>
      {sp.novo && (
        <div className="mb-4">
          <Notice tone="success">Pedidos registrados! Cada loja recebeu o seu pedido.</Notice>
        </div>
      )}
      {!orders.length ? (
        <EmptyState title="Você ainda não fez pedidos" action={<ButtonLink href="/market">Explorar o Market</ButtonLink>} />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/conta/pedidos/${o.id}`}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[var(--shadow-card)] hover:border-navy-2"
              >
                <span>
                  <span className="block font-semibold text-navy">Pedido #{o.number}</span>
                  <span className="block text-sm text-muted">
                    {o.stores?.name} · {new Date(o.created_at).toLocaleDateString("pt-BR")} · {o.order_items.length}{" "}
                    {o.order_items.length === 1 ? "item" : "itens"}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-bold text-navy">{formatBRL(o.total_cents)}</span>
                  <OrderStatus status={o.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function Page({ searchParams }: PageProps<"/conta/pedidos">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 font-display text-2xl font-bold tracking-tight text-navy">Meus pedidos</h1>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Orders searchParams={searchParams as Promise<{ novo?: string }>} />
      </Suspense>
    </div>
  );
}
