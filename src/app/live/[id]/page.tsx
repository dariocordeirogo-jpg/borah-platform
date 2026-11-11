import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Gavel, ShoppingBag } from "lucide-react";
import { LiveChat } from "@/components/live/chat";
import { LivePlayer } from "@/components/live/player";
import { LiveRefresh } from "@/components/live/live-refresh";
import { Button, ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { liveStatusLabel } from "@/lib/live/format";
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

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <LiveRefresh liveId={live.id} />
      <div className="space-y-4">
        <LivePlayer src={live.playback_url} status={live.status} />
        <div>
          <p className="text-xs font-semibold text-muted">
            {liveStatusLabel[live.status]} ·{" "}
            <Link href={`/loja/${live.stores?.slug}`} className="text-brand hover:underline">
              {live.stores?.name}
            </Link>
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-navy">{live.title}</h1>
          {live.description && <p className="mt-1 text-sm text-muted">{live.description}</p>}
          {live.status === "scheduled" && (
            <p className="mt-2 text-sm text-navy">
              Começa em {new Date(live.scheduled_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </p>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        {activeAuction && (
          <section aria-label="Leilão relâmpago" className="rounded-[var(--radius-card)] border-2 border-brand bg-white p-4">
            <p className="flex items-center gap-2 text-xs font-bold tracking-wider text-brand">
              <Gavel className="h-4 w-4" aria-hidden="true" /> LEILÃO RELÂMPAGO
            </p>
            <p className="mt-1 font-semibold text-navy">{activeAuction.title}</p>
            <p className="text-sm text-muted">
              {activeAuction.bids_count ? "Maior lance" : "Lance inicial"}{" "}
              <span className="font-bold text-navy" data-testid="leilao-live-preco">
                {formatBRL(activeAuction.current_price_cents ?? activeAuction.starting_price_cents)}
              </span>
            </p>
            <ButtonLink href={`/leilao/${activeAuction.id}`} variant="buy" className="mt-3 w-full">
              Dar lance
            </ButtonLink>
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
