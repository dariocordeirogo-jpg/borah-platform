import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Gavel, ShoppingBag } from "lucide-react";
import { BidPanel } from "@/components/auctions/bid-panel";
import { LiveChat } from "@/components/live/chat";
import { LivePlayer } from "@/components/live/player";
import { LiveRefresh } from "@/components/live/live-refresh";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { liveStatusLabel } from "@/lib/live/format";
import { getAuction } from "@/lib/auctions/queries";
import { getLive, type LiveProduct } from "@/lib/live/queries";
import { addToCart } from "@/lib/market/actions";

export const metadata: Metadata = { title: "Live" };

function ProductRow({ p, highlight }: { p: LiveProduct; highlight?: boolean }) {
  return (
    <div className={highlight ? "flex items-center gap-3 rounded-xl border-2 border-brand bg-white p-3" : "flex items-center gap-3 p-3"}>
      <Link href={`/produto/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        {p.imageUrl ? (
          <Image src={p.imageUrl} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface">
            <ShoppingBag className="h-5 w-5 text-muted" aria-hidden="true" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-navy">{p.title}</span>
          <span className="block text-sm font-bold text-navy">{formatBRL(p.priceCents)}</span>
        </span>
      </Link>
      {p.stock > 0 ? (
        <form action={addToCart}>
          <input type="hidden" name="productId" value={p.id} />
          <input type="hidden" name="quantity" value="1" />
          <input type="hidden" name="buyNow" value="1" />
          <Button type="submit" variant={highlight ? "buy" : "outline"} size="sm">
            {highlight ? "Comprar agora" : "Comprar"}
          </Button>
        </form>
      ) : (
        <span className="text-xs font-semibold text-muted">Esgotado</span>
      )}
    </div>
  );
}

async function Room({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, user] = await Promise.all([getLive(id), getCurrentUser()]);
  if (!data) notFound();
  const { live, products, pinned, auction, messages } = data;
  const activeAuction = auction && auction.status === "active" ? auction : null;
  // Leilão aberto na live: lance aqui mesmo, sem sair da transmissão (mesmo painel e regras da página do leilão)
  const lot = activeAuction ? await getAuction(activeAuction.id) : null;

  return (
    <div className="grid grid-cols-1 gap-5 [&>*]:min-w-0 lg:grid-cols-[1fr_360px]">
      <LiveRefresh liveId={live.id} />
      <div className="space-y-4">
        <LivePlayer src={live.playback_url} status={live.status} title={live.title} />
        <div>
          <p className="text-xs font-semibold text-muted">
            {liveStatusLabel[live.status]} ·{" "}
            <Link href={`/loja/${live.stores?.slug}`} className="text-brand hover:underline">
              {live.stores?.name}
            </Link>
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-navy">{live.title}</h1>
          {live.description && <p className="mt-1 text-sm text-muted">{live.description}</p>}
          <Link href={`/denunciar?tipo=live&id=${live.id}&next=/live/${live.id}`} className="mt-1 inline-block text-xs text-muted hover:text-brand hover:underline">
            Denunciar esta live
          </Link>
          {live.status === "scheduled" && (
            <p className="mt-2 text-sm text-navy">
              Começa em {new Date(live.scheduled_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </p>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        {activeAuction && lot && (
          <section aria-label="Leilão ao vivo" className="space-y-3 rounded-[var(--radius-card)] border-2 border-brand bg-white p-4" data-testid="leilao-live">
            <div className="flex items-start gap-3">
              {lot.images[0] ? (
                <Image src={lot.images[0].url} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-lg border border-line object-contain" />
              ) : null}
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-brand">
                  <Gavel className="h-4 w-4" aria-hidden="true" /> LEILÃO AO VIVO
                </p>
                <p className="font-semibold leading-snug text-navy">{lot.auction.title}</p>
                <p className="sr-only" data-testid="leilao-live-preco">
                  {formatBRL(lot.auction.current_price_cents ?? lot.auction.starting_price_cents)}
                </p>
                <Link href={`/leilao/${lot.auction.id}`} className="text-xs text-muted hover:text-brand hover:underline">
                  Ver detalhes do lote e histórico
                </Link>
              </div>
            </div>
            <BidPanel
              auctionId={lot.auction.id}
              serverNow={lot.serverNow}
              startsAt={lot.auction.starts_at}
              startingCents={lot.auction.starting_price_cents}
              incrementCents={lot.auction.min_increment_cents}
              reserveCents={lot.auction.reserve_price_cents}
              initial={{
                current: lot.auction.current_price_cents,
                endsAt: lot.auction.ends_at,
                bidsCount: lot.auction.bids_count,
                leaderAlias: lot.auction.leader_alias,
                status: lot.auction.status,
              }}
              bids={lot.bids}
              me={{
                loggedIn: !!lot.me?.logged_in,
                isSeller: !!lot.me?.is_seller,
                isLeader: !!lot.me?.is_leader,
                blocker: lot.me ? lot.me.blocker : "not_authenticated",
              }}
              returnTo={`/live/${live.id}`}
            />
          </section>
        )}
        {pinned && !activeAuction && (
          <section aria-label="Produto em destaque">
            <p className="mb-2 text-xs font-bold tracking-wider text-brand">EM DESTAQUE AGORA</p>
            <ProductRow p={pinned} highlight />
          </section>
        )}
        <LiveChat
          liveId={live.id}
          initial={messages}
          canSend={live.status === "live"}
          loggedIn={Boolean(user)}
        />
        {products.length > 0 && (
          <section aria-label="Produtos da live" className="rounded-[var(--radius-card)] border border-line bg-white">
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-navy">Produtos da live</h2>
            <div className="divide-y divide-line">
              {products.map((p) => (
                <ProductRow key={p.id} p={p} />
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}

export default function Page({ params }: PageProps<"/live/[id]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Room params={params} />
      </Suspense>
    </div>
  );
}
