import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { LiveForm } from "@/components/live/live-form";
import { EmptyState } from "@/components/market";
import { ButtonLink } from "@/components/ui/button";
import { getLiveProductsForSeller } from "@/lib/live/queries";
import { requireStore } from "@/lib/market/seller-guard";

export const metadata: Metadata = { title: "Programar live" };

/** Próxima hora cheia no horário de Brasília, no formato do campo datetime-local. */
function nextHourBrasilia(): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000 + 60 * 60 * 1000);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString().slice(0, 16);
}

async function NewLive() {
  const store = await requireStore("/seller/lives/nova");
  await connection();
  const products = await getLiveProductsForSeller(store.id);
  if (!products.length) {
    return (
      <EmptyState title="Nenhum produto à venda" action={<ButtonLink href="/seller/produtos/novo">Cadastrar produto</ButtonLink>}>
        Cadastre produtos ativos para mostrar na live.
      </EmptyState>
    );
  }
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
      <LiveForm products={products} defaultStart={nextHourBrasilia()} />
    </div>
  );
}

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Programar live</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <NewLive />
      </Suspense>
    </div>
  );
}
