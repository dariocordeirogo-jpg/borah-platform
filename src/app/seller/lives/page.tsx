import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/market";
import { ButtonLink } from "@/components/ui/button";
import { liveStatusLabel } from "@/lib/live/format";
import { getSellerLives } from "@/lib/live/queries";
import { requireStore } from "@/lib/market/seller-guard";

export const metadata: Metadata = { title: "Lives" };

async function Lives() {
  const store = await requireStore("/seller/lives");
  const lives = await getSellerLives(store.id);
  if (!lives.length) {
    return (
      <EmptyState title="Nenhuma live programada" action={<ButtonLink href="/seller/lives/nova">Programar live</ButtonLink>}>
        Venda ao vivo: mostre os produtos, responda no chat e abra leilões relâmpago.
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
      {lives.map((l) => (
        <li key={l.id}>
          <Link href={`/seller/lives/${l.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-surface">
            <span>
              <span className="block font-semibold text-navy">{l.title}</span>
              <span className="block text-xs text-muted">
                {new Date(l.scheduled_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              </span>
            </span>
            <span className={l.status === "live" ? "rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-white" : "rounded-full bg-navy-soft px-2.5 py-0.5 text-xs font-semibold text-navy"}>
              {liveStatusLabel[l.status]}
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Lives</h1>
        <ButtonLink href="/seller/lives/nova" size="sm">
          <Plus className="h-4 w-4" aria-hidden="true" /> Programar live
        </ButtonLink>
      </div>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Lives />
      </Suspense>
    </div>
  );
}
