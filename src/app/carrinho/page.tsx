import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Store, Trash2 } from "lucide-react";
import { EmptyState, ProductImage } from "@/components/market";
import { Button, ButtonLink } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { removeFromCart, updateCartQuantity } from "@/lib/market/actions";
import { getCart } from "@/lib/market/queries";

export const metadata: Metadata = { title: "Carrinho", robots: { index: false } };

async function Cart() {
  const cart = await getCart();
  if (!cart) redirect("/entrar?next=/carrinho");
  if (!cart.items.length) {
    return (
      <EmptyState title="Seu carrinho está vazio" action={<ButtonLink href="/market">Explorar o Market</ButtonLink>}>
        Encontre produtos no ZEXI MARKET.
      </EmptyState>
    );
  }

  const byStore = new Map<string, { name: string; slug: string; items: typeof cart.items }>();
  for (const item of cart.items) {
    const key = item.store?.id ?? "?";
    if (!byStore.has(key)) byStore.set(key, { name: item.store?.name ?? "Loja", slug: item.store?.slug ?? "", items: [] });
    byStore.get(key)!.items.push(item);
  }

  return (
    <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {[...byStore.entries()].map(([id, group]) => (
          <section key={id} className="rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)]">
            <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold text-navy">
              <Store className="h-4 w-4 text-brand" aria-hidden="true" />
              <Link href={`/loja/${group.slug}`} className="hover:underline">
                {group.name}
              </Link>
            </h2>
            <ul className="divide-y divide-line">
              {group.items.map((item) => (
                <li key={item.productId} className="flex gap-3 p-4">
                  <Link href={`/produto/${item.productId}`} className="w-20 shrink-0">
                    <ProductImage src={item.imageUrl} alt={item.title} sizes="80px" className="rounded-lg" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/produto/${item.productId}`} className="line-clamp-2 text-sm text-ink hover:underline">
                      {item.title}
                    </Link>
                    <p className="text-sm font-semibold text-navy">{formatBRL(item.priceCents)}</p>
                    {item.problem && <p className="text-xs font-semibold text-danger">{item.problem}</p>}
                    <div className="mt-2 flex items-center gap-2">
                      <form action={updateCartQuantity} className="flex items-center gap-1">
                        <input type="hidden" name="productId" value={item.productId} />
                        <label className="sr-only" htmlFor={`q-${item.productId}`}>
                          Quantidade
                        </label>
                        <select
                          id={`q-${item.productId}`}
                          name="quantity"
                          defaultValue={String(item.quantity)}
                          className="h-9 rounded-lg border border-line bg-white px-2 text-sm"
                        >
                          {Array.from({ length: Math.max(item.quantity, Math.min(item.stock, 10)) }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {i + 1}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" variant="ghost" size="sm">
                          Atualizar
                        </Button>
                      </form>
                      <form action={removeFromCart}>
                        <input type="hidden" name="productId" value={item.productId} />
                        <Button type="submit" variant="ghost" size="sm" aria-label={`Remover ${item.title}`}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" /> Remover
                        </Button>
                      </form>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-navy">{formatBRL(item.lineTotalCents)}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <aside className="h-fit rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)] lg:sticky lg:top-32">
        <h2 className="font-display text-lg font-bold text-navy">Resumo</h2>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Produtos ({cart.count})</dt>
            <dd>{formatBRL(cart.totalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Frete</dt>
            <dd className="text-muted">A combinar</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-navy">
            <dt>Total</dt>
            <dd>{formatBRL(cart.totalCents)}</dd>
          </div>
        </dl>
        {byStore.size > 1 && (
          <p className="mt-3 text-xs text-muted">Produtos de {byStore.size} lojas geram {byStore.size} pedidos separados.</p>
        )}
        {cart.hasProblems ? (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">Ajuste os itens marcados para continuar.</p>
        ) : (
          <ButtonLink href="/checkout" variant="buy" size="lg" className="mt-4 w-full">
            Finalizar compra
          </ButtonLink>
        )}
      </aside>
    </div>
  );
}

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <h1 className="mb-6 font-display text-2xl font-bold tracking-tight text-navy">Carrinho</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Cart />
      </Suspense>
    </div>
  );
}
