import { Clock3 } from "lucide-react";
import { Countdown } from "@/components/countdown";
import { DemoMark, ListingCard, LiveCard } from "@/components/listing";
import type { DemoAuction, DemoProduct, DemoUpcoming } from "@/lib/demo-data";

/* Cards da vitrine de DEMONSTRAÇÃO (home enquanto não há itens reais). Sempre marcados como "Demonstração". */

export function DemoTag({ className }: { className?: string }) {
  return <DemoMark className={className} />;
}

export function AuctionCard({ auction }: { auction: DemoAuction }) {
  return (
    <ListingCard
      href="/leiloes"
      title={auction.title}
      imageUrl={auction.image}
      badge={auction.live ? "live" : "auction"}
      demo
      priceLabel="Maior lance"
      priceCents={auction.currentBidCents}
      meta={
        <span className="flex flex-wrap items-center gap-x-1.5">
          <span>{auction.bids} lances</span>
          <span className="inline-flex items-center gap-0.5 font-semibold text-navy-2">
            <Clock3 className="h-3 w-3" aria-label="Termina em" />
            <Countdown endsInSeconds={auction.endsInSeconds} />
          </span>
        </span>
      }
      store={auction.category}
    />
  );
}

export function UpcomingCard({ item }: { item: DemoUpcoming }) {
  return (
    <ListingCard
      href="/leiloes?aba=programados"
      title={item.title}
      imageUrl={item.image}
      badge="scheduled"
      demo
      priceLabel="Lance inicial"
      priceCents={item.startPriceCents}
      meta={
        <span className="flex flex-wrap items-center gap-x-1.5">
          <span>Abre em</span>
          <span className="inline-flex items-center gap-0.5 font-semibold text-navy-2">
            <Clock3 className="h-3 w-3" aria-hidden="true" />
            <Countdown endsInSeconds={item.startsInSeconds} urgentBelow={0} />
          </span>
        </span>
      }
      store={item.seller}
    />
  );
}

export function ProductCard({ product }: { product: DemoProduct }) {
  return (
    <ListingCard
      href="/market"
      title={product.title}
      imageUrl={product.image}
      demo
      priceCents={product.priceCents}
      compareAtCents={product.oldPriceCents}
      store={product.store}
    />
  );
}

export function DemoLiveCard({ live }: { live: { id: string; title: string; store: string; viewers: number; image: string } }) {
  return <LiveCard href="/ao-vivo" title={live.title} store={live.store} imageUrl={live.image} live viewers={live.viewers} demo />;
}
