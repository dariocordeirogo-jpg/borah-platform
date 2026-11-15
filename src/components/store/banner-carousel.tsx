import Image from "next/image";
import Link from "next/link";
import type { StoreBanner } from "@/lib/stores/queries";

/** Banners da loja em faixa deslizante (rolagem nativa com encaixe; sem script). */
export function BannerCarousel({ banners, storeName }: { banners: StoreBanner[]; storeName: string }) {
  if (!banners.length) return null;
  return (
    <section aria-label={`Banners da loja ${storeName}`} className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 md:mx-0 md:px-0">
      {banners.map((b, i) => {
        const img = (
          <Image
            src={b.imageUrl}
            alt={b.title ?? `Banner ${i + 1} da loja ${storeName}`}
            width={1200}
            height={400}
            priority={i === 0}
            className="aspect-[3/1] w-full rounded-[var(--radius-card)] object-cover"
          />
        );
        return (
          <div key={b.id} className="relative w-[88%] shrink-0 snap-center md:w-full" data-testid="banner-publico">
            {b.productId ? (
              <Link href={`/produto/${b.productId}`} aria-label={b.title ?? `Ver produto do banner ${i + 1}`}>
                {img}
              </Link>
            ) : (
              img
            )}
            {b.title && (
              <p className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/55 px-3 py-1 text-sm font-semibold text-white">{b.title}</p>
            )}
          </div>
        );
      })}
    </section>
  );
}
