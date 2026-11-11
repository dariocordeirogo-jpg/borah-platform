import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Search, ShoppingBag } from "lucide-react";
import { EmptyState, Pagination, ProductGrid } from "@/components/market";
import { ButtonLink } from "@/components/ui/button";
import { getCategories, listProducts, type SortKey } from "@/lib/market/queries";
import { cn } from "@/lib/utils";
import { SmartSearch } from "@/components/ai/smart-search";
import { aiConfigured } from "@/lib/ai/claude";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "LIVELANCE MARKET: compre de lojas brasileiras com preço fixo, carrinho e entrega.",
  alternates: { canonical: "/market" },
};

type SP = Promise<{
  q?: string | string[];
  categoria?: string | string[];
  ordem?: string | string[];
  pagina?: string | string[];
  preco_min?: string | string[];
  preco_max?: string | string[];
  condicao?: string | string[];
  ia?: string | string[];
}>;
const conditions = { new: "Novo", used: "Usado", refurbished: "Recondicionado" } as const;
const reais = (v: string | undefined) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 && n <= 10_000_000 ? n : undefined;
};
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const sorts: { key: SortKey; label: string }[] = [
  { key: "recentes", label: "Mais recentes" },
  { key: "menor-preco", label: "Menor preço" },
  { key: "maior-preco", label: "Maior preço" },
];

async function Catalog({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = one(sp.q)?.trim().slice(0, 100) || undefined;
  const categoria = one(sp.categoria) || undefined;
  const ordem = (sorts.find((s) => s.key === one(sp.ordem))?.key ?? "recentes") as SortKey;
  const page = Math.max(1, Number(one(sp.pagina)) || 1);
  const precoMin = reais(one(sp.preco_min));
  const precoMax = reais(one(sp.preco_max));
  const condicaoRaw = one(sp.condicao);
  const condicao = condicaoRaw && condicaoRaw in conditions ? (condicaoRaw as keyof typeof conditions) : undefined;
  const viaIA = one(sp.ia) === "1";

  const [categories, result] = await Promise.all([
    getCategories(),
    listProducts({
      q,
      categorySlug: categoria,
      sort: ordem,
      page,
      minPriceCents: precoMin ? precoMin * 100 : undefined,
      maxPriceCents: precoMax ? precoMax * 100 : undefined,
      condition: condicao,
    }),
  ]);
  const current = categories.find((c) => c.slug === categoria);

  const href = (over: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string | number | undefined> = {
      q,
      categoria,
      ordem: ordem === "recentes" ? undefined : ordem,
      preco_min: precoMin,
      preco_max: precoMax,
      condicao,
      pagina: undefined,
      ...over,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v === undefined || v === "" || (k === "pagina" && Number(v) <= 1)) continue;
      params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `/market?${s}` : "/market";
  };

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <aside aria-label="Filtros" className="md:sticky md:top-32 md:self-start">
        <form action="/market" role="search" className="mb-4">
          {categoria && <input type="hidden" name="categoria" value={categoria} />}
          <label htmlFor="busca-market" className="sr-only">
            Buscar no Market
          </label>
          <div className="flex h-11 items-center rounded-full border border-line bg-white pl-4 focus-within:border-navy-2">
            <input
              id="busca-market"
              name="q"
              defaultValue={q}
              type="search"
              placeholder="Buscar no Market"
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            />
            <button type="submit" aria-label="Buscar" className="mr-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white hover:bg-brand-dark">
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </form>
        {aiConfigured() && <SmartSearch />}
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-brand">Categorias</h2>
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:gap-0.5 md:px-0">
          <li>
            <Link
              href={href({ categoria: undefined })}
              className={cn(
                "block whitespace-nowrap rounded-full px-3 py-1.5 text-sm md:rounded-lg",
                !categoria ? "bg-brand-soft font-semibold text-brand-dark" : "text-navy hover:bg-surface",
              )}
            >
              Todas
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={href({ categoria: c.slug })}
                aria-current={c.slug === categoria ? "page" : undefined}
                className={cn(
                  "block whitespace-nowrap rounded-full px-3 py-1.5 text-sm md:rounded-lg",
                  c.slug === categoria ? "bg-brand-soft font-semibold text-brand-dark" : "text-navy hover:bg-surface",
                )}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section aria-labelledby="titulo-catalogo">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="titulo-catalogo" className="font-display text-2xl font-bold tracking-tight text-navy">
              {q ? `Resultados para “${q}”` : current ? current.name : "Todos os produtos"}
            </h1>
            <p className="text-sm text-muted">
              {result.total} {result.total === 1 ? "produto" : "produtos"}
            </p>
            {(precoMin || precoMax || condicao) && (
              <ul className="mt-2 flex flex-wrap gap-1.5 text-xs" aria-label="Filtros aplicados" data-testid="filtros-aplicados">
                {viaIA && <li className="rounded-full bg-navy px-2.5 py-1 font-semibold text-white">Entendido pela IA</li>}
                {precoMin && <li className="rounded-full bg-navy-soft px-2.5 py-1 text-navy">a partir de R$ {precoMin}</li>}
                {precoMax && <li className="rounded-full bg-navy-soft px-2.5 py-1 text-navy">até R$ {precoMax}</li>}
                {condicao && <li className="rounded-full bg-navy-soft px-2.5 py-1 text-navy">{conditions[condicao]}</li>}
                <li>
                  <Link href={href({ preco_min: undefined, preco_max: undefined, condicao: undefined })} className="px-1 text-brand hover:underline">
                    Limpar filtros
                  </Link>
                </li>
              </ul>
            )}
          </div>
          <nav aria-label="Ordenar" className="flex flex-wrap gap-1 text-sm">
            {sorts.map((s) => (
              <Link
                key={s.key}
                href={href({ ordem: s.key === "recentes" ? undefined : s.key })}
                aria-current={s.key === ordem ? "true" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5",
                  s.key === ordem ? "bg-navy text-white" : "border border-line text-navy hover:bg-surface",
                )}
              >
                {s.label}
              </Link>
            ))}
          </nav>
        </div>

        {result.items.length ? (
          <>
            <ProductGrid products={result.items} />
            <Pagination page={result.page} pages={result.pages} href={(p) => href({ pagina: p })} />
          </>
        ) : (
          <EmptyState
            title={q || categoria ? "Nada encontrado" : "O Market está começando"}
            action={
              q || categoria ? (
                <ButtonLink href="/market" variant="outline">
                  Ver todos os produtos
                </ButtonLink>
              ) : (
                <ButtonLink href="/vender">Seja um dos primeiros vendedores</ButtonLink>
              )
            }
          >
            {q || categoria
              ? "Tente outra palavra ou outra categoria."
              : "Ainda não há produtos à venda. Abra sua loja e publique o primeiro anúncio da LIVELANCE."}
          </EmptyState>
        )}
      </section>
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/market">) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:py-8">
      <p className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand">
        <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" /> LIVELANCE MARKET
      </p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Catalog searchParams={searchParams as SP} />
      </Suspense>
    </div>
  );
}
