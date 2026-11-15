import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Store } from "lucide-react";
import { EmptyState, Pagination, ProductGrid } from "@/components/market";
import { StoreReputation } from "@/components/reviews/store-reputation";
import { BannerCarousel } from "@/components/store/banner-carousel";
import { getStoreBySlug, listProducts } from "@/lib/market/queries";
import { getStoreReputations } from "@/lib/reviews/queries";
import { storeMediaUrl, themeOf } from "@/lib/stores/format";
import { getStoreShowcase } from "@/lib/stores/queries";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/loja/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return { title: "Loja não encontrada" };
  return {
    title: store.name,
    description: (store.tagline || store.description)?.slice(0, 160) ?? `Loja ${store.name} na Zexi.`,
    alternates: { canonical: `/loja/${store.slug}` },
    openGraph: store.cover_path ? { images: [storeMediaUrl(store.cover_path)] } : undefined,
  };
}

type SP = { pagina?: string };

async function StorePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const store = await getStoreBySlug(slug);
  if (!store) notFound();
  const page = Number(sp.pagina) || 1;
  const [result, reputations, showcase] = await Promise.all([
    listProducts({ storeId: store.id, page }),
    getStoreReputations([store.id]),
    getStoreShowcase(store.id),
  ]);
  const theme = themeOf(store.theme);
  const since = new Date(store.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const deals = page === 1 ? result.items.filter((p) => p.compareAtCents && p.compareAtCents > p.priceCents).slice(0, 10) : [];

  return (
    <div data-testid="pagina-loja" data-tema={store.theme}>
      {/* Capa: imagem da loja ou degradê na cor escolhida */}
      <div className={cn("relative h-36 overflow-hidden bg-gradient-to-br sm:h-48 md:h-60", theme.from, theme.to)}>
        {store.cover_path && (
          <Image src={storeMediaUrl(store.cover_path)} alt="" fill priority sizes="100vw" className="object-cover" />
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4">
        <header className="relative -mt-12 flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center">
          <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-md">
            {store.logo_path ? (
              <Image src={storeMediaUrl(store.logo_path)} alt={`Logo da ${store.name}`} width={96} height={96} className="h-full w-full object-cover" />
            ) : (
              <span className={cn("flex h-full w-full items-center justify-center text-white", theme.bg)}>
                <Store className="h-9 w-9" aria-hidden="true" />
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold tracking-tight text-navy">{store.name}</h1>
            {store.tagline && <p className={cn("mt-0.5 font-medium", theme.text)}>{store.tagline}</p>}
            <p className="mt-1 text-sm text-muted">
              Na Zexi desde {since} · {result.total} {result.total === 1 ? "produto" : "produtos"}
            </p>
          </div>
          <div className="sm:w-80">
            <StoreReputation reputation={reputations.get(store.id)} compact />
          </div>
        </header>

        <nav aria-label="Seções da loja" className="mt-4 flex gap-1 overflow-x-auto border-b border-line text-sm">
          {[
            ["#inicio", "Início"],
            ...(showcase.featured.length ? [["#destaques", "Destaques"]] : []),
            ...(deals.length ? [["#ofertas", "Ofertas"]] : []),
            ["#produtos", "Todos os produtos"],
            ...(store.description ? [["#sobre", "Sobre a loja"]] : []),
          ].map(([href, label]) => (
            <a key={href} href={href} className="whitespace-nowrap border-b-2 border-transparent px-3 py-2 font-medium text-muted hover:border-brand hover:text-navy">
              {label}
            </a>
          ))}
        </nav>

        <div id="inicio" className="mt-5 space-y-8 pb-6">
          <BannerCarousel banners={showcase.banners} storeName={store.name} />

          {showcase.featured.length > 0 && (
            <section id="destaques" aria-label="Destaques da loja" className="scroll-mt-32">
              <h2 className="mb-3 font-display text-xl font-bold text-navy">Destaques</h2>
              <ProductGrid products={showcase.featured} />
            </section>
          )}

          {deals.length > 0 && (
            <section id="ofertas" aria-label="Ofertas da loja" className="scroll-mt-32">
              <h2 className="mb-3 font-display text-xl font-bold text-navy">Ofertas da loja</h2>
              <ProductGrid products={deals} />
            </section>
          )}

          <section id="produtos" aria-label="Todos os produtos" className="scroll-mt-32">
            <h2 className="mb-3 font-display text-xl font-bold text-navy">Todos os produtos</h2>
            {result.items.length ? (
              <>
                <ProductGrid products={result.items} />
                <Pagination page={result.page} pages={result.pages} href={(p) => `/loja/${store.slug}?pagina=${p}#produtos`} />
              </>
            ) : (
              <EmptyState title="Nenhum produto à venda ainda">Esta loja ainda não publicou produtos.</EmptyState>
            )}
          </section>

          {store.description && (
            <section id="sobre" aria-label="Sobre a loja" className="scroll-mt-32 rounded-[var(--radius-card)] border border-line bg-white p-5">
              <h2 className="font-display text-xl font-bold text-navy">Sobre a loja</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-ink">{store.description}</p>
              <div className="mt-4 max-w-md">
                <StoreReputation reputation={reputations.get(store.id)} />
              </div>
              <p className="mt-4 text-xs text-muted">
                Converse com a loja pelas perguntas nos anúncios e compre pela Zexi para ter a Compra Garantida.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Page({ params, searchParams }: PageProps<"/loja/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-6 h-96 max-w-7xl animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
      <StorePage params={params} searchParams={searchParams as Promise<SP>} />
    </Suspense>
  );
}
