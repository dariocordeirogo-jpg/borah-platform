import type { Metadata } from "next";
import { Suspense } from "react";
import { AuctionForm } from "@/components/auctions/auction-form";
import { EmptyState } from "@/components/market";
import { ButtonLink } from "@/components/ui/button";
import { getAuctionableProducts } from "@/lib/auctions/queries";
import { requireStore } from "@/lib/market/seller-guard";

export const metadata: Metadata = { title: "Abrir leilão" };

async function NewAuction() {
  const store = await requireStore("/seller/leiloes/novo");
  const products = await getAuctionableProducts(store.id);
  if (!products.length) {
    return (
      <EmptyState title="Nenhum produto com estoque" action={<ButtonLink href="/seller/produtos/novo">Cadastrar produto</ButtonLink>}>
        Para leiloar, cadastre um produto com pelo menos 1 unidade em estoque.
      </EmptyState>
    );
  }
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
      <AuctionForm products={products} />
    </div>
  );
}

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Abrir leilão</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <NewAuction />
      </Suspense>
    </div>
  );
}
