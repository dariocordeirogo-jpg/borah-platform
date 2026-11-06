import Link from "next/link";
import { Gavel, Radio, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Countdown } from "@/components/countdown";
import { formatBRL } from "@/lib/format";
import type { DemoAuction, DemoProduct, DemoUpcoming } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

/** Espaço da foto do produto (ícone neutro enquanto não há fotos reais). */
function ProductArt({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <div
      className={cn(
        "flex aspect-[4/3] items-center justify-center rounded-t-[var(--radius-card)] bg-surface text-navy-2",
        className,
      )}
    >
      <Icon className="h-14 w-14" strokeWidth={1.4} aria-hidden="true" />
    </div>
  );
}

export function DemoTag({ className }: { className?: string }) {
  return (
    <span className={cn("rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted", className)}>
      Demonstração
    </span>
  );
}

export function AuctionCard({ auction }: { auction: DemoAuction }) {
  const next = auction.currentBidCents + auction.minIncrementCents;
  return (
    <article className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white text-ink shadow-[var(--shadow-card)]">
      <div className="relative">
        <ProductArt icon={auction.icon} />
        {auction.live ? (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">
            <Radio className="h-3.5 w-3.5" aria-hidden="true" /> AO VIVO
          </span>
        ) : (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-navy">
            <Gavel className="h-3.5 w-3.5" aria-hidden="true" /> Leilão
          </span>
        )}
        <DemoTag className="absolute right-3 top-3 bg-white/95" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-xs text-muted">{auction.category}</p>
          <h3 className="mt-0.5 line-clamp-2 font-semibold leading-snug">{auction.title}</h3>
          {auction.live && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {auction.live.viewers.toLocaleString("pt-BR")} assistindo · {auction.live.host}
            </p>
          )}
        </div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-2">Maior lance</p>
            <p className="text-2xl font-extrabold tracking-tight text-navy">{formatBRL(auction.currentBidCents)}</p>
            <p className="text-xs text-muted">{auction.bids} lances</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Termina em</p>
            <Countdown endsInSeconds={auction.endsInSeconds} className="text-lg font-semibold" />
          </div>
        </div>
        <Link
          href="/leiloes"
          className="btn-buy mt-auto flex h-11 items-center justify-center gap-1.5 rounded-full text-sm font-bold"
        >
          <Gavel className="h-4 w-4" aria-hidden="true" /> Dar lance · {formatBRL(next)}
        </Link>
      </div>
    </article>
  );
}

export function UpcomingCard({ item }: { item: DemoUpcoming }) {
  return (
    <article className="flex gap-3 rounded-[var(--radius-card)] border border-line bg-white p-3 shadow-[var(--shadow-card)]">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-surface text-navy-2">
        <item.icon className="h-9 w-9" strokeWidth={1.4} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted">{item.seller}</p>
          <DemoTag />
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold">{item.title}</h3>
        <p className="mt-1 text-xs text-muted">
          Lance inicial <span className="font-semibold text-ink">{formatBRL(item.startPriceCents)}</span>
        </p>
        <p className="text-xs text-navy-2">
          Abre em <Countdown endsInSeconds={item.startsInSeconds} urgentBelow={0} className="font-semibold" />
        </p>
      </div>
    </article>
  );
}

export function ProductCard({ product }: { product: DemoProduct }) {
  const discount = product.oldPriceCents
    ? Math.round((1 - product.priceCents / product.oldPriceCents) * 100)
    : null;
  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)]">
      <div className="relative">
        <ProductArt icon={product.icon} />
        <DemoTag className="absolute right-3 top-3 bg-white/95" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-sm leading-snug">{product.title}</h3>
        {product.oldPriceCents && (
          <p className="mt-2 text-xs text-muted line-through">{formatBRL(product.oldPriceCents)}</p>
        )}
        <p className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-navy">{formatBRL(product.priceCents)}</span>
          {discount && <span className="text-sm font-semibold text-brand">{discount}% OFF</span>}
        </p>
        <p className="text-xs text-muted">
          em até {product.installments}x de {formatBRL(Math.round(product.priceCents / product.installments))}
        </p>
        <Link
          href="/market"
          className="btn-buy mt-3 flex h-10 items-center justify-center rounded-full text-sm font-bold"
        >
          Comprar agora
        </Link>
      </div>
    </article>
  );
}
