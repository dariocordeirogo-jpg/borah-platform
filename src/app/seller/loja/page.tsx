import type { Metadata } from "next";
import { Suspense } from "react";
import { StoreSettingsForm } from "@/components/seller-forms";
import { requireStore } from "@/lib/market/seller-guard";

export const metadata: Metadata = { title: "Loja" };

async function Settings() {
  const store = await requireStore("/seller/loja");
  return (
    <>
      <p className="mb-4 text-sm text-muted">
        Endereço da loja: <span className="font-medium text-navy">zexi.com.br/loja/{store.slug}</span> (não pode ser alterado)
      </p>
      <StoreSettingsForm store={store} />
    </>
  );
}

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Minha loja</h1>
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
        <Suspense fallback={<div className="h-48" />}>
          <Settings />
        </Suspense>
      </div>
    </div>
  );
}
