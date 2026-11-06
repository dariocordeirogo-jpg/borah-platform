import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { EmptyState, ProductImage } from "@/components/market";
import { ButtonLink } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { productStatusLabel } from "@/lib/market/format";
import { getSellerProducts } from "@/lib/market/queries";
import { requireStore } from "@/lib/market/seller-guard";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Produtos" };

async function Products() {
  const store = await requireStore("/seller/produtos");
  const products = await getSellerProducts(store.id);
  if (!products.length) {
    return (
      <EmptyState title="Nenhum produto ainda" action={<ButtonLink href="/seller/produtos/novo">Cadastrar produto</ButtonLink>}>
        Cadastre seu primeiro produto, envie as fotos e coloque como “Ativo” para aparecer no Market.
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)]">
      {products.map((p) => (
        <li key={p.id}>
          <Link href={`/seller/produtos/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-surface">
            <ProductImage src={p.imageUrl} alt="" sizes="56px" className="w-14 shrink-0 rounded-lg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-ink">{p.title}</span>
              <span className="block text-sm text-muted">
                {formatBRL(p.price_cents)} · estoque {p.stock}
                {!p.imageUrl && " · sem foto"}
              </span>
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                p.status === "active" ? "bg-success-soft text-success" : p.status === "paused" ? "bg-surface-2 text-muted" : "bg-navy-soft text-navy",
              )}
            >
              {productStatusLabel[p.status]}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Produtos</h1>
        <ButtonLink href="/seller/produtos/novo">
          <Plus className="h-4 w-4" aria-hidden="true" /> Novo produto
        </ButtonLink>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Products />
      </Suspense>
    </div>
  );
}
