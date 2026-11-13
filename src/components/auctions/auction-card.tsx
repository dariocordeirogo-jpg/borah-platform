import { Clock3 } from "lucide-react";
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
      badge={scheduled ? "scheduled" : ended ? "ended" : a.liveId ? "live" : "auction"}
      priceLabel={a.currentCents === null ? "Lance inicial" : ended ? "Lance final" : "Maior lance"}
      priceCents={a.currentCents ?? a.startingCents}
      store={a.store?.name}
      priority={priority}
      meta={
        ended ? (
          <span className="font-semibold">{a.outcome ? outcomeLabel[a.outcome] : "Encerrado"}</span>
        ) : (
          <span className="flex flex-wrap items-center gap-x-1.5">
            <span>{scheduled ? "Abre em" : lances}</span>
            <span className="inline-flex items-center gap-0.5 font-semibold text-navy-2">
              <Clock3 className="h-3 w-3" aria-label={scheduled ? undefined : "Termina em"} />
              <AuctionTimer target={scheduled ? a.startsAt : a.endsAt} serverNow={serverNow} />
            </span>
          </span>
        )
      }
    />
  );
}
