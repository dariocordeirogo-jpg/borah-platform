import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/market";
import { ButtonLink } from "@/components/ui/button";
import { outcomeLabel } from "@/lib/auctions/format";
import { getMyBids } from "@/lib/auctions/queries";
import { getCurrentUser } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Meus lances", robots: { index: false } };

async function Bids() {
  if (!(await getCurrentUser())) redirect("/entrar?next=/conta/lances");
  const bids = await getMyBids();
  if (!bids.length) {
    return <EmptyState title="Você ainda não deu lances" action={<ButtonLink href="/leiloes">Ver leilões</ButtonLink>} />;
  }
  return (
    <ul className="space-y-3">
      {bids.map((b) => {
        const status =
          b.status === "active"
            ? b.is_leader
              ? { t: "Você está ganhando", c: "bg-success-soft text-success" }
              : { t: "Seu lance foi superado", c: "bg-red-50 text-danger" }
            : b.is_winner && b.outcome === "sold"
              ? b.order_id
                ? { t: "Arrematado · pedido criado", c: "bg-success-soft text-success" }
                : { t: "Você venceu · confirme o arremate", c: "bg-brand-soft text-brand-dark" }
              : { t: b.outcome ? outcomeLabel[b.outcome as keyof typeof outcomeLabel] : "Encerrado", c: "bg-surface-2 text-muted" };
        return (
          <li key={b.auction_id}>
            <Link href={`/leilao/${b.auction_id}`} className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[var(--shadow-card)] hover:border-navy-2">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-navy">{b.title}</span>
                <span className="block text-sm text-muted">
                  Seu maior lance {formatBRL(b.my_max_cents)} · atual {formatBRL(b.current_price_cents ?? 0)}
                </span>
              </span>
              <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", status.c)}>{status.t}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 font-display text-2xl font-bold tracking-tight text-navy">Meus lances</h1>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Bids />
      </Suspense>
    </div>
  );
}
