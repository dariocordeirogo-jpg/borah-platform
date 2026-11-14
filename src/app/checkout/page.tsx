import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CheckoutFlow, type CheckoutGroup } from "@/components/checkout/checkout-flow";
import { getCart, getMyAddresses } from "@/lib/market/queries";
import { payTestMode } from "@/lib/pay/stripe";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false } };

async function Checkout() {
  const cart = await getCart();
  if (!cart) redirect("/entrar?next=/checkout");
  if (!cart.items.length || cart.hasProblems) redirect("/carrinho");
  const addresses = await getMyAddresses();

  // Um envio por loja (cada loja despacha o seu pacote)
  const groups = new Map<string, CheckoutGroup>();
  for (const i of cart.items) {
    if (!i.store) continue;
    const g = groups.get(i.store.id) ?? { store: { id: i.store.id, name: i.store.name, slug: i.store.slug }, items: [] };
    g.items.push({ productId: i.productId, title: i.title, imageUrl: i.imageUrl, quantity: i.quantity, priceCents: i.priceCents, lineTotalCents: i.lineTotalCents });
    groups.set(i.store.id, g);
  }

  return (
    <CheckoutFlow
      addresses={addresses}
      groups={[...groups.values()]}
      productsCents={cart.totalCents}
      count={cart.count}
      testMode={payTestMode()}
    />
  );
}

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
      <h1 className="mb-4 font-display text-2xl font-bold tracking-tight text-navy">Finalizar compra</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Checkout />
      </Suspense>
    </div>
  );
}
