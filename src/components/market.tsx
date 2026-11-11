import Image from "next/image";
import Link from "next/link";
import { ImageOff, PackageOpen } from "lucide-react";
import type { ReactNode } from "react";
import { formatBRL } from "@/lib/format";
import { conditionLabel } from "@/lib/market/format";
import type { ProductCardData } from "@/lib/market/queries";
import { cn } from "@/lib/utils";

export function ProductImage({
  src,
  alt,
  className,
  sizes = "(max-width: 768px) 50vw, 20vw",
  priority,
}: {
  src: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("relative aspect-square overflow-hidden bg-surface", className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-contain" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted">
          <ImageOff className="h-10 w-10" strokeWidth={1.4} aria-hidden="true" />
          <span className="sr-only">Sem foto</span>
        </div>
      )}
    </div>
  );
}

export function Price({ cents, compareAt, size = "md" }: { cents: number; compareAt?: number | null; size?: "md" | "lg" }) {
  const discount = compareAt ? Math.round((1 - cents / compareAt) * 100) : null;
  return (
    <div>
      {compareAt ? <p className="text-xs text-muted line-through">{formatBRL(compareAt)}</p> : null}
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn("font-bold tracking-tight text-navy", size === "lg" ? "text-3xl" : "text-xl")}>
          {formatBRL(cents)}
        </span>
        {discount ? <span className="text-sm font-semibold text-brand">{discount}% OFF</span> : null}
      </p>
    </div>
  );
}

/** Card de produto real do LIVELANCE MARKET. */
export function MarketProductCard({ product }: { product: ProductCardData }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)] transition-shadow hover:shadow-lg">
      <ProductImage src={product.imageUrl} alt={product.title} />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm leading-snug text-ink">
          <Link href={`/produto/${product.id}`} className="after:absolute after:inset-0">
            {product.title}
          </Link>
        </h3>
        <Price cents={product.priceCents} compareAt={product.compareAtCents} />
        <p className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted">
          <span className="truncate">{product.store?.name}</span>
          <span className="shrink-0">{product.stock > 0 ? conditionLabel[product.condition] : "Esgotado"}</span>
        </p>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((p) => (
        <li key={p.id} className="flex">
          <div className="w-full">
            <MarketProductCard product={p} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line bg-white px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <PackageOpen className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mt-4 font-display text-xl font-bold text-navy">{title}</h2>
      {children ? <div className="mt-2 max-w-md text-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Páginas" className="mt-8 flex items-center justify-center gap-2 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className="rounded-full border border-line px-4 py-2 text-navy hover:bg-surface">
          Anterior
        </Link>
      ) : null}
      <span className="px-2 text-muted">
        Página {page} de {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className="rounded-full border border-line px-4 py-2 text-navy hover:bg-surface">
          Próxima
        </Link>
      ) : null}
    </nav>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "error"; children: ReactNode }) {
  const cls =
    tone === "success"
      ? "bg-success-soft text-success"
      : tone === "error"
        ? "bg-red-50 text-danger"
        : "bg-navy-soft text-navy";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={cn("rounded-xl px-4 py-3 text-sm", cls)}>
      {children}
    </p>
  );
}
