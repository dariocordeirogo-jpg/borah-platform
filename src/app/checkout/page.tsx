import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Info } from "lucide-react";
import { AddressForm, PlaceOrderForm } from "@/components/checkout-forms";
import { formatBRL } from "@/lib/format";
import { getCart, getMyAddresses } from "@/lib/market/queries";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false } };

async function Checkout() {
  const cart = await getCart();
  if (!cart) redirect("/entrar?next=/checkout");
  if (!cart.items.length || cart.hasProblems) redirect("/carrinho");
  const addresses = await getMyAddresses();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <h2 className="font-display text-lg font-bold text-navy">Endereço de entrega</h2>
        <AddressForm open={!addresses.length} />
        <p className="flex items-start gap-2 rounded-xl bg-navy-soft px-4 py-3 text-sm text-navy">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          O pagamento (LIVELANCE PAY) chega na Fase 4. Ao finalizar, seu pedido é registrado, o estoque fica reservado
          para você e o pedido aparece como “Aguardando pagamento”. Nenhuma cobrança é feita.
        </p>
      </div>
      <aside className="h-fit rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-display text-lg font-bold text-navy">Seu pedido</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {cart.items.map((i) => (
            <li key={i.productId} className="flex justify-between gap-3">
              <span className="line-clamp-1 text-ink">
                {i.quantity}× {i.title}
              </span>
              <span className="shrink-0 text-navy">{formatBRL(i.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-line pt-3 font-bold text-navy">
          <span>Total</span>
          <span>{formatBRL(cart.totalCents)}</span>
        </div>
        <p className="mb-4 text-xs text-muted">Frete a combinar com a loja nesta fase.</p>
        <PlaceOrderForm addresses={addresses} />
      </aside>
    </div>
  );
}

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <h1 className="mb-6 font-display text-2xl font-bold tracking-tight text-navy">Finalizar compra</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Checkout />
      </Suspense>
    </div>
  );
}
