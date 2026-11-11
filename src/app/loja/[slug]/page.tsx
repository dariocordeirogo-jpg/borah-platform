import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Store } from "lucide-react";
import { EmptyState, Pagination, ProductGrid } from "@/components/market";
import { getStoreBySlug, listProducts } from "@/lib/market/queries";

export async function generateMetadata({ params }: PageProps<"/loja/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return { title: "Loja não encontrada" };
  return {
    title: store.name,
    description: store.description?.slice(0, 160) ?? `Loja ${store.name} na LIVELANCE.`,
    alternates: { canonical: `/loja/${store.slug}` },
  };
}

async function StorePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ pagina?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const store = await getStoreBySlug(slug);
  if (!store) notFound();
  const result = await listProducts({ storeId: store.id, page: Number(sp.pagina) || 1 });
  const since = new Date(store.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <>
      <header className="mb-6 flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Store className="h-7 w-7" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-navy">{store.name}</h1>
          <p className="text-sm text-muted">
            Na LIVELANCE desde {since} · {result.total} {result.total === 1 ? "produto" : "produtos"}
          </p>
          {store.description && <p className="mt-2 text-sm text-ink">{store.description}</p>}
        </div>
      </header>
      {result.items.length ? (
        <>
          <ProductGrid products={result.items} />
          <Pagination page={result.page} pages={result.pages} href={(p) => `/loja/${store.slug}?pagina=${p}`} />
        </>
      ) : (
        <EmptyState title="Nenhum produto à venda ainda">Esta loja ainda não publicou produtos.</EmptyState>
      )}
    </>
  );
}

export default function Page({ params, searchParams }: PageProps<"/loja/[slug]">) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <StorePage params={params} searchParams={searchParams as Promise<{ pagina?: string }>} />
      </Suspense>
    </div>
  );
}
