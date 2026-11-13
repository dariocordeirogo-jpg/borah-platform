import { AuctionTimer } from "@/components/auctions/auction-timer";
import { ListingCard } from "@/components/listing";
import { outcomeLabel } from "@/lib/auctions/format";
import type { AuctionCardData } from "@/lib/auctions/queries";

/** Card de leilão real: maior lance em destaque, lances e cronômetro oficial (relógio do servidor). */
export function AuctionCardLive({ a, serverNow, priority }: { a: AuctionCardData; serverNow: string; priority?: boolean }) {
  const scheduled = a.status === "active" && new Date(a.startsAt).getTime() > new Date(serverNow).getTime();
  const ended = a.status !== "active";
  const lances = `${a.bidsCount} ${a.bidsCount === 1 ? "lance" : "lances"}`;
  return (
    <ListingCard
      href={`/leilao/${a.id}`}
      title={a.title}
      imageUrl={a.imageUrl}
      badge={scheduled ? "scheduled" : ended ? "ended" : "auction"}
      priceLabel={a.currentCents === null ? "Lance inicial" : ended ? "Lance final" : "Maior lance"}
      priceCents={a.currentCents ?? a.startingCents}
      store={a.store?.name}
      priority={priority}
      meta={
        ended ? (
          <span className="font-semibold">{a.outcome ? outcomeLabel[a.outcome] : "Encerrado"}</span>
        ) : (
          <span className="flex flex-wrap items-center gap-x-1">
            {!scheduled && <span>{lances} ·</span>}
            <span>{scheduled ? "abre em" : "termina em"}</span>
            <AuctionTimer target={scheduled ? a.startsAt : a.endsAt} serverNow={serverNow} className="font-semibold" />
          </span>
        )
      }
    />
  );
}
