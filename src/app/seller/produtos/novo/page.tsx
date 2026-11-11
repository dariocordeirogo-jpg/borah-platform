import type { Metadata } from "next";
import { aiConfigured } from "@/lib/ai/claude";
import { Suspense } from "react";
import { ProductForm } from "@/components/seller-forms";
import { getCategories } from "@/lib/market/queries";
import { requireStore } from "@/lib/market/seller-guard";

export const metadata: Metadata = { title: "Novo produto" };

async function NewProduct() {
  await requireStore("/seller/produtos/novo");
  const categories = await getCategories();
  return <ProductForm categories={categories} aiEnabled={aiConfigured()} />;
}

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Novo produto</h1>
      <p className="text-sm text-muted">Depois de criar, você envia as fotos.</p>
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
        <Suspense fallback={<div className="h-96" />}>
          <NewProduct />
        </Suspense>
      </div>
    </div>
  );
}
