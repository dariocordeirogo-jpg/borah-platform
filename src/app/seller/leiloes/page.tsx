import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { EmptyState, Notice } from "@/components/market";
import { Button, ButtonLink } from "@/components/ui/button";
import { cancelAuction } from "@/lib/auctions/actions";
import { outcomeLabel } from "@/lib/auctions/format";
import { getSellerAuctions } from "@/lib/auctions/queries";
import { formatBRL } from "@/lib/format";
import { requireStore } from "@/lib/market/seller-guard";

export const metadata: Metadata = { title: "Leilões" };

async function List({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const [store, sp] = await Promise.all([requireStore("/seller/leiloes"), searchParams]);
  const auctions = await getSellerAuctions(store.id);
  return (
    <div className="space-y-3">
      {sp.erro && <Notice tone="error">{sp.erro}</Notice>}
      {!auctions.length ? (
        <EmptyState title="Nenhum leilão ainda" action={<ButtonLink href="/seller/leiloes/novo">Abrir leilão</ButtonLink>}>
          Escolha um produto com estoque, defina lance inicial, incremento e duração.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)]">
          {auctions.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <Link href={`/leilao/${a.id}`} className="min-w-0 hover:underline">
                <span className="block truncate font-medium text-ink">
                  {a.title} {a.relist_count > 0 && <span className="text-xs text-muted">(relançado)</span>}
                </span>
                <span className="block text-sm text-muted">
                  {a.status === "active"
                    ? `${a.bids_count} lances · ${formatBRL(a.current_price_cents ?? a.starting_price_cents)} · termina ${new Date(a.ends_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
                    : `${a.outcome ? outcomeLabel[a.outcome as keyof typeof outcomeLabel] : a.status}${a.current_price_cents ? ` · ${formatBRL(a.current_price_cents)}` : ""}`}
                </span>
              </Link>
              {a.status === "active" && a.bids_count === 0 && (
                <form action={cancelAuction}>
                  <input type="hidden" name="auctionId" value={a.id} />
                  <Button type="submit" variant="outline" size="sm">Cancelar</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/seller/leiloes">) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Leilões</h1>
        <ButtonLink href="/seller/leiloes/novo">
          <Plus className="h-4 w-4" aria-hidden="true" /> Abrir leilão
        </ButtonLink>
      </div>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <List searchParams={searchParams as Promise<{ erro?: string }>} />
      </Suspense>
    </div>
  );
}
