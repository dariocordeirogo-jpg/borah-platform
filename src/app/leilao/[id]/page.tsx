import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Gavel, Store, Trophy } from "lucide-react";
import { BidPanel } from "@/components/auctions/bid-panel";
import { Gallery } from "@/components/gallery";
import { Notice } from "@/components/market";
import { ButtonLink } from "@/components/ui/button";
import { outcomeLabel } from "@/lib/auctions/format";
import { getAuction } from "@/lib/auctions/queries";
import { formatBRL } from "@/lib/format";
import { conditionLabel } from "@/lib/market/format";

export async function generateMetadata({ params }: PageProps<"/leilao/[id]">): Promise<Metadata> {
  const { id } = await params;
  const d = await getAuction(id);
  if (!d) return { title: "Leilão não encontrado" };
  return {
    title: `Leilão: ${d.auction.title}`,
    description: `Lance inicial ${formatBRL(d.auction.starting_price_cents)} na LIVELANCE LEILÕES.`,
    alternates: { canonical: `/leilao/${d.auction.id}` },
    openGraph: { images: d.images[0] ? [d.images[0].url] : undefined },
  };
}

async function Auction({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criado?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const d = await getAuction(id);
  if (!d) notFound();
  const { auction: a, me } = d;
  const ended = a.status !== "active";

  return (
    <div className="grid gap-8 md:grid-cols-[1.05fr_1fr]">
      <div className="space-y-6">
        <Gallery images={d.images} title={a.title} />
        {a.products?.description && (
          <section>
            <h2 className="font-display text-lg font-bold text-navy">Sobre o lote</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">{a.products.description}</p>
          </section>
        )}
      </div>
      <div className="space-y-4">
        {sp.criado && <Notice tone="success">Leilão criado! Uma unidade do produto ficou reservada para ele.</Notice>}
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-bold text-brand">
            <Gavel className="h-3.5 w-3.5" aria-hidden="true" /> LIVELANCE LEILÕES
            {a.relist_count > 0 && <span className="text-muted">· relançado</span>}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight text-navy md:text-3xl">{a.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {a.products && conditionLabel[a.products.condition]} · incremento mínimo {formatBRL(a.min_increment_cents)}
          </p>
        </div>

        {ended && a.outcome && (
          <Notice tone={a.outcome === "sold" ? "success" : "info"}>
            {outcomeLabel[a.outcome]}
            {a.winning_bid_cents ? ` por ${formatBRL(a.winning_bid_cents)}` : ""}.
          </Notice>
        )}
        {me?.is_winner && a.outcome === "sold" && (
          <div className="rounded-[var(--radius-card)] border border-brand/30 bg-brand-soft p-4">
            <p className="flex items-center gap-2 font-semibold text-navy">
              <Trophy className="h-5 w-5 text-brand" aria-hidden="true" /> Você arrematou este lote!
            </p>
            {a.order_id ? (
              <Link href={`/conta/pedidos/${a.order_id}`} className="mt-2 inline-block text-sm font-semibold text-brand underline">
                Ver pedido do arremate
              </Link>
            ) : (
              <>
                <p className="mt-1 text-sm text-ink">
                  Confirme até {a.payment_due_at && new Date(a.payment_due_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Sem
                  confirmação, você perde o arremate e o lote volta para leilão.
                </p>
                <ButtonLink href={`/leilao/${a.id}/arremate`} variant="buy" className="mt-3">
                  Confirmar arremate
                </ButtonLink>
              </>
            )}
          </div>
        )}

        <BidPanel
          auctionId={a.id}
          serverNow={d.serverNow}
          startsAt={a.starts_at}
          startingCents={a.starting_price_cents}
          incrementCents={a.min_increment_cents}
          reserveCents={a.reserve_price_cents}
          initial={{
            current: a.current_price_cents,
            endsAt: a.ends_at,
            bidsCount: a.bids_count,
            leaderAlias: a.leader_alias,
            status: a.status,
          }}
          bids={d.bids}
          me={{
            loggedIn: !!me?.logged_in,
            isSeller: !!me?.is_seller,
            isLeader: !!me?.is_leader,
            blocker: me ? me.blocker : "not_authenticated",
          }}
        />

        {a.stores && (
          <Link href={`/loja/${a.stores.slug}`} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 hover:border-navy-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Store className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-xs text-muted">Leiloado por</span>
              <span className="block font-semibold text-navy">{a.stores.name}</span>
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

export default function Page({ params, searchParams }: PageProps<"/leilao/[id]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Auction params={params} searchParams={searchParams as Promise<{ criado?: string }>} />
      </Suspense>
    </div>
  );
}
