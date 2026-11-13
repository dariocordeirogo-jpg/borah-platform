import Image from "next/image";
import Link from "next/link";
import { ImageOff, PackageOpen, ShoppingCart } from "lucide-react";
import { addToCart } from "@/lib/market/actions";
import type { ReactNode } from "react";
import { ListingCard, ListingGrid } from "@/components/listing";
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

/** Botão redondo de carrinho sobre a foto do card (como nos apps de marketplace). */
function QuickAdd({ productId, title }: { productId: string; title: string }) {
  return (
    <form action={addToCart}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="quantity" value="1" />
      <button
        type="submit"
        aria-label={`Adicionar ${title} ao carrinho`}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-brand shadow-[0_1px_4px_rgba(15,17,21,0.15)] transition-colors hover:bg-brand hover:text-white"
      >
        <ShoppingCart className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  );
}

/** Card de produto real do ZEXI MARKET. */
export function MarketProductCard({ product, priority }: { product: ProductCardData; priority?: boolean }) {
  return (
    <ListingCard
      href={`/produto/${product.id}`}
      title={product.title}
      imageUrl={product.imageUrl}
      priceCents={product.priceCents}
      compareAtCents={product.compareAtCents}
      store={product.store?.name}
      priority={priority}
      meta={product.stock > 0 ? conditionLabel[product.condition] : <span className="font-semibold text-danger">Esgotado</span>}
      action={product.stock > 0 ? <QuickAdd productId={product.id} title={product.title} /> : undefined}
    />
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <ListingGrid label="Produtos">
      {products.map((p, i) => (
        <li key={p.id}>
          <MarketProductCard product={p} priority={i < 4} />
        </li>
      ))}
    </ListingGrid>
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
