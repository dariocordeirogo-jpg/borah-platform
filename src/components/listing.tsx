import Image from "next/image";
import Link from "next/link";
import { CalendarClock, Gavel, ImageOff, Radio, Users } from "lucide-react";
import type { ReactNode } from "react";
import { ShelfTrack } from "@/components/shelf-track";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

/* Cards e vitrines no padrão de marketplace: foto quadrada em fundo branco, preço em destaque,
   card inteiro clicável e nenhuma promessa que a plataforma ainda não cumpre (frete grátis, parcelamento). */

export type ListingBadge = "live" | "auction" | "scheduled" | "ended" | null;

const badgeStyle: Record<Exclude<ListingBadge, null>, { cls: string; icon: typeof Radio; text: string }> = {
  live: { cls: "bg-brand text-white", icon: Radio, text: "AO VIVO" },
  auction: { cls: "bg-white text-navy ring-1 ring-line", icon: Gavel, text: "Leilão" },
  scheduled: { cls: "bg-white text-navy ring-1 ring-line", icon: CalendarClock, text: "Em breve" },
  ended: { cls: "bg-surface-2 text-muted", icon: Gavel, text: "Encerrado" },
};

export function Badge({ kind, className }: { kind: Exclude<ListingBadge, null>; className?: string }) {
  const b = badgeStyle[kind];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold leading-4", b.cls, className)}>
      <b.icon className="h-3 w-3" aria-hidden="true" /> {b.text}
    </span>
  );
}

export function DemoMark({ className }: { className?: string }) {
  return (
    <span className={cn("rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium leading-4 text-muted ring-1 ring-line", className)}>
      Demonstração
    </span>
  );
}

/** Preço no estilo de vitrine: reais grandes e centavos menores, em cima. */
export function BigPrice({ cents, className }: { cents: number; className?: string }) {
  const [reais, centavos] = formatBRL(cents).replace(/\s/g, " ").split(",");
  return (
    <span className={cn("inline-flex items-start font-normal tracking-tight text-ink tabular-nums", className)}>
      <span>{reais}</span>
      <span className="ml-0.5 mt-[0.15em] text-[0.55em] leading-none">{centavos}</span>
    </span>
  );
}

export function discountPercent(cents: number, compareAt?: number | null) {
  if (!compareAt || compareAt <= cents) return null;
  const pct = Math.round((1 - cents / compareAt) * 100);
  return pct > 0 ? pct : null;
}

export function ListingImage({ src, alt, sizes, priority }: { src?: string | null; alt: string; sizes?: string; priority?: boolean }) {
  return (
    <div className="relative aspect-square overflow-hidden bg-white">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes ?? "(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"}
          priority={priority}
          className="object-contain p-2 transition-transform duration-300 group-hover:scale-[1.03] sm:p-3"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-surface text-muted">
          <ImageOff className="h-9 w-9" strokeWidth={1.4} aria-hidden="true" />
          <span className="sr-only">Sem foto</span>
        </div>
      )}
    </div>
  );
}

export type ListingCardProps = {
  href: string;
  title: string;
  imageUrl?: string | null;
  badge?: ListingBadge;
  demo?: boolean;
  /** Rótulo acima do preço (ex.: "Maior lance") */
  priceLabel?: string;
  priceCents: number;
  compareAtCents?: number | null;
  /** Linha logo abaixo do preço (lances, cronômetro, estoque) */
  meta?: ReactNode;
  store?: string | null;
  priority?: boolean;
  className?: string;
};

/** Card de vitrine (produto ou leilão). O card inteiro é o link. */
export function ListingCard({
  href,
  title,
  imageUrl,
  badge,
  demo,
  priceLabel,
  priceCents,
  compareAtCents,
  meta,
  store,
  priority,
  className,
}: ListingCardProps) {
  const off = discountPercent(priceCents, compareAtCents);
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-lg border border-line bg-white transition-shadow duration-200 hover:shadow-[0_6px_20px_rgba(15,17,21,0.12)]",
        className,
      )}
    >
      <div className="relative border-b border-line/70">
        <ListingImage src={imageUrl} alt={title} priority={priority} />
        {badge && <Badge kind={badge} className="absolute left-2 top-2" />}
        {demo && <DemoMark className="absolute bottom-2 left-2" />}
      </div>
      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-[13px] leading-5 text-ink/85 sm:text-sm">
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            {title}
          </Link>
        </h3>
        <div className="mt-1.5">
          {priceLabel && <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{priceLabel}</p>}
          {off && compareAtCents ? <p className="text-xs leading-4 text-muted line-through">{formatBRL(compareAtCents)}</p> : null}
          <p className="flex flex-wrap items-center gap-x-1.5">
            <BigPrice cents={priceCents} className="text-xl sm:text-2xl" />
            {off ? <span className="text-sm font-semibold text-brand">{off}% OFF</span> : null}
          </p>
        </div>
        {meta ? <div className="mt-1 text-xs text-muted">{meta}</div> : null}
        {store ? <p className="mt-auto truncate pt-2 text-xs text-muted">{store}</p> : null}
      </div>
    </article>
  );
}

/** Card de transmissão (16:9). */
export function LiveCard({
  href,
  title,
  store,
  imageUrl,
  live,
  viewers,
  when,
  demo,
}: {
  href: string;
  title: string;
  store?: string | null;
  imageUrl?: string | null;
  live: boolean;
  viewers?: number;
  when?: string;
  demo?: boolean;
}) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-line bg-white transition-shadow duration-200 hover:shadow-[0_6px_20px_rgba(15,17,21,0.12)]">
      <div className="relative aspect-video overflow-hidden bg-navy">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 80vw, (max-width: 1024px) 48vw, 400px"
            className="object-cover opacity-95 transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-navy to-navy-2 text-white/40">
            <Radio className="h-10 w-10" aria-hidden="true" />
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 p-2">
          {live ? <Badge kind="live" /> : <Badge kind="scheduled" />}
          {live && viewers !== undefined && (
            <span className="inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-white">
              <Users className="h-3 w-3" aria-hidden="true" /> {viewers.toLocaleString("pt-BR")}
            </span>
          )}
        </div>
        {demo && <DemoMark className="absolute bottom-2 left-2" />}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-ink">
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            {title}
          </Link>
        </h3>
        {store && <p className="truncate text-xs text-muted">{store}</p>}
        {!live && when && <p className="text-xs font-medium text-navy-2">{when}</p>}
      </div>
    </article>
  );
}

/** Seção de vitrine: painel branco com título, link "Ver todos" e trilho de cards. */
export function Shelf({
  title,
  href,
  cta = "Ver todos",
  eyebrow,
  children,
  size = "product",
  track = true,
  className,
}: {
  title: string;
  href?: string;
  cta?: string;
  eyebrow?: ReactNode;
  children: ReactNode;
  size?: "product" | "live";
  /** false = conteúdo livre (sem trilho) */
  track?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(15,17,21,0.08)] md:p-5", className)}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow}
          <h2 className="truncate font-display text-lg font-bold tracking-tight text-navy md:text-xl">{title}</h2>
        </div>
        {href && (
          <Link href={href} className="shrink-0 text-sm font-semibold text-brand hover:text-brand-dark hover:underline">
            {cta}
          </Link>
        )}
      </div>
      {track ? (
        <ShelfTrack label={title} size={size}>
          {children}
        </ShelfTrack>
      ) : (
        children
      )}
    </section>
  );
}

/** Grade de resultados (Market, loja, leilões): 2 colunas no celular até 5 no computador. */
export function ListingGrid({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 xl:grid-cols-5">
      {children}
    </ul>
  );
}
