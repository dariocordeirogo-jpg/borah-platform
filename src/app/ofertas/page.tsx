import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgePercent, Tag, Wallet, Zap } from "lucide-react";
import { EmptyState, MarketProductCard, Pagination, ProductGrid } from "@/components/market";
import { ListingGrid } from "@/components/listing";
import { Countdown } from "@/components/offers/countdown";
import { ButtonLink } from "@/components/ui/button";
import { getCategories } from "@/lib/market/queries";
import { isOfferTab, OFFER_TABS, type OfferTab } from "@/lib/offers/format";
import { listFlashDeals, listOffers } from "@/lib/offers/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Ofertas",
  description: "Ofertas do dia e ofertas relâmpago das lojas da Zexi. Novos descontos todos os dias.",
  alternates: { canonical: "/ofertas" },
};

type SP = Promise<{ aba?: string; categoria?: string; pagina?: string }>;
const icons: Record<OfferTab, typeof Tag> = { todas: BadgePercent, relampago: Zap, "30-off": Tag, "ate-50": Wallet };

async function Offers({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab: OfferTab = isOfferTab(sp.aba) ? sp.aba : "todas";
  const categoria = sp.categoria || undefined;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const href = (over: { aba?: OfferTab; categoria?: string | null; pagina?: number }) => {
    const p = new URLSearchParams();
    const a = over.aba ?? tab;
    const c = over.categoria === null ? undefined : (over.categoria ?? categoria);
    if (a !== "todas") p.set("aba", a);
    if (c && a !== "relampago") p.set("categoria", c);
    if (over.pagina && over.pagina > 1) p.set("pagina", String(over.pagina));
    const s = p.toString();
    return s ? `/ofertas?${s}` : "/ofertas";
  };

  const [categories, flash, offers] = await Promise.all([
    getCategories(),
    tab === "relampago" ? listFlashDeals() : Promise.resolve(null),
    tab === "relampago" ? Promise.resolve(null) : listOffers({ tab, categorySlug: categoria, page }),
  ]);

  return (
    <>
      <nav aria-label="Tipos de oferta" className="-mx-4 flex gap-2 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        {OFFER_TABS.map((t) => {
          const Icon = icons[t.key];
          const on = t.key === tab;
          return (
            <Link
              key={t.key}
              href={href({ aba: t.key, pagina: 1 })}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex min-w-28 flex-col items-center gap-1 border-b-2 px-3 pb-3 pt-2 text-center text-sm",
                on ? "border-brand font-semibold text-navy" : "border-transparent text-muted hover:text-ink",
              )}
            >
              <Icon className={cn("h-7 w-7", on ? "text-brand" : "text-navy-2")} aria-hidden="true" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 grid grid-cols-1 gap-6 [&>*]:min-w-0 md:grid-cols-[200px_1fr]">
        <aside aria-label="Categorias" className={cn(tab === "relampago" && "hidden md:block md:invisible")}>
          <h2 className="mb-2 text-sm font-semibold text-navy">Categorias</h2>
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 text-sm md:mx-0 md:flex-col md:gap-0.5 md:px-0">
            <li>
              <Link href={href({ categoria: null, pagina: 1 })} className={cn("block whitespace-nowrap rounded-md px-2 py-1", !categoria ? "font-semibold text-brand" : "text-muted hover:text-ink")}>
                Todas
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={href({ categoria: c.slug, pagina: 1 })}
                  className={cn("block whitespace-nowrap rounded-md px-2 py-1", categoria === c.slug ? "font-semibold text-brand" : "text-muted hover:text-ink")}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <section aria-label="Ofertas">
          {flash ? (
            flash.length ? (
              <>
                <p className="mb-3 text-sm text-muted">Descontos por tempo limitado. Quando o relógio zera, o preço volta ao normal.</p>
                <ListingGrid label="Ofertas relâmpago">
                  {flash.map((p, i) => (
                    <li key={p.id} className="space-y-1">
                      <Countdown endsAt={p.endsAt} />
                      <MarketProductCard product={p} priority={i < 4} />
                    </li>
                  ))}
                </ListingGrid>
              </>
            ) : (
              <EmptyState title="Nenhuma oferta relâmpago agora" action={<ButtonLink href="/ofertas">Ver todas as ofertas</ButtonLink>}>
                As lojas lançam ofertas relâmpago ao longo do dia. Volte daqui a pouco.
              </EmptyState>
            )
          ) : offers && offers.items.length ? (
            <>
              <p className="mb-3 text-sm text-muted">{offers.total === 1 ? "1 produto" : `${offers.total.toLocaleString("pt-BR")} produtos`}</p>
              <ProductGrid products={offers.items} />
              <Pagination page={offers.page} pages={offers.pages} href={(p) => href({ pagina: p })} />
            </>
          ) : (
            <EmptyState title="Nenhuma oferta encontrada" action={<ButtonLink href="/market">Ver todos os produtos</ButtonLink>}>
              Tente outra categoria ou volte mais tarde: novas ofertas todos os dias.
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}

export default function Page({ searchParams }: PageProps<"/ofertas">) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4">
        <h1 className="font-display text-3xl font-bold tracking-tight text-navy">Ofertas</h1>
        <p className="mt-1 text-sm text-muted">Aproveite esses preços agora mesmo. Novas ofertas todos os dias.</p>
      </header>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Offers searchParams={searchParams as SP} />
      </Suspense>
    </div>
  );
}
