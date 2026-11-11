import Link from "next/link";
import { CalendarClock, Gavel } from "lucide-react";
import { AuctionTimer } from "@/components/auctions/auction-timer";
import { ProductImage } from "@/components/market";
import { outcomeLabel } from "@/lib/auctions/format";
import type { AuctionCardData } from "@/lib/auctions/queries";
import { formatBRL } from "@/lib/format";

export function AuctionCardLive({ a, serverNow }: { a: AuctionCardData; serverNow: string }) {
  const scheduled = a.status === "active" && new Date(a.startsAt).getTime() > new Date(serverNow).getTime();
  const ended = a.status !== "active";
  return (
    <article className="relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white text-ink shadow-[var(--shadow-card)]">
      <div className="relative">
        <ProductImage src={a.imageUrl} alt={a.title} />
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-navy">
          {scheduled ? <CalendarClock className="h-3.5 w-3.5 text-brand" aria-hidden="true" /> : <Gavel className="h-3.5 w-3.5 text-brand" aria-hidden="true" />}
          {scheduled ? "Programado" : ended ? "Encerrado" : "Leilão"}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <p className="truncate text-xs text-muted">{a.store?.name}</p>
          <h3 className="line-clamp-2 font-semibold leading-snug">
            <Link href={`/leilao/${a.id}`} className="after:absolute after:inset-0">
              {a.title}
            </Link>
          </h3>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-2">
              {a.currentCents === null ? "Lance inicial" : ended ? "Lance final" : "Maior lance"}
            </p>
            <p className="text-2xl font-extrabold tracking-tight text-navy">{formatBRL(a.currentCents ?? a.startingCents)}</p>
            <p className="text-xs text-muted">
              {a.bidsCount} {a.bidsCount === 1 ? "lance" : "lances"}
            </p>
          </div>
          <div className="text-right">
            {ended ? (
              <p className="text-xs font-semibold text-muted">{a.outcome ? outcomeLabel[a.outcome] : "Encerrado"}</p>
            ) : (
              <>
                <p className="text-xs text-muted">{scheduled ? "Abre em" : "Termina em"}</p>
                <AuctionTimer target={scheduled ? a.startsAt : a.endsAt} serverNow={serverNow} className="text-lg font-semibold" />
              </>
            )}
          </div>
        </div>
        {!ended && !scheduled && (
          <span className="btn-buy pointer-events-none mt-auto flex h-11 items-center justify-center gap-1.5 rounded-full text-sm font-bold">
            <Gavel className="h-4 w-4" aria-hidden="true" /> Dar lance · {formatBRL(a.nextMinCents)}
          </span>
        )}
      </div>
    </article>
  );
}
