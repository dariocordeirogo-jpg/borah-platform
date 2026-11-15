import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BulkImport } from "@/components/importer/bulk-import";
import { getCategories } from "@/lib/market/queries";
import { requireStore } from "@/lib/market/seller-guard";

export const metadata: Metadata = { title: "Importar anúncios em massa" };

async function Importer() {
  await requireStore("/seller/produtos/importar-em-massa");
  const categories = await getCategories();
  return <BulkImport categories={categories} />;
}

export default function Page() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Importar anúncios em massa</h1>
        <p className="mt-1 text-sm text-muted">
          Traga seus anúncios do Mercado Livre, Shopee, Shopify, Nuvemshop e outras plataformas de uma vez. Todos entram como
          rascunho para você revisar. Para um anúncio só, use{" "}
          <Link href="/seller/produtos/importar" className="text-brand hover:underline">
            importar um link
          </Link>
          .
        </p>
      </div>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Importer />
      </Suspense>
    </div>
  );
}
