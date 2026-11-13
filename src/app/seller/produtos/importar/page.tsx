import type { Metadata } from "next";
import { Suspense } from "react";
import { ImportFlow } from "@/components/importer/import-flow";
import { getCategories } from "@/lib/market/queries";
import { requireStore } from "@/lib/market/seller-guard";

export const metadata: Metadata = { title: "Importar anúncio" };

async function Importer() {
  await requireStore("/seller/produtos/importar");
  const categories = await getCategories();
  return <ImportFlow categories={categories} />;
}

export default function Page() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Importar anúncio de outro site</h1>
        <p className="mt-1 text-sm text-muted">
          Cole o link de um anúncio seu em outra loja virtual. Puxamos título, preço, fotos e descrição; você revisa e ele entra como
          rascunho.
        </p>
      </div>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Importer />
      </Suspense>
    </div>
  );
}
