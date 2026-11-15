import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Banknote, ChevronRight, CreditCard, Flag, Lock, PackageCheck, QrCode, ShieldCheck, Truck } from "lucide-react";
import { Gallery } from "@/components/gallery";
import { BuyBox } from "@/components/product/buy-box";
import { ProductVideo } from "@/components/product/product-video";
import { ProductQuestions } from "@/components/questions/product-questions";
import { ProductReviews } from "@/components/reviews/product-reviews";
import { Stars } from "@/components/reviews/stars";
import { StoreReputation } from "@/components/reviews/store-reputation";
import { BigPrice } from "@/components/listing";
import { MarketProductCard, Notice } from "@/components/market";
import { isStaff } from "@/lib/admin/format";
import { getCurrentUser } from "@/lib/auth";
import { conditionLabel } from "@/lib/market/format";
import { getProduct, listProducts } from "@/lib/market/queries";
import { getProductQuestions } from "@/lib/questions/queries";
import { ratingText } from "@/lib/reviews/format";
import { getProductReviews, getStoreReputations } from "@/lib/reviews/queries";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import { JsonLd } from "@/components/seo/json-ld";
import { TrackView } from "@/components/home/recently-viewed";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/produto/[id]">): Promise<Metadata> {
  const { id } = await params;
  const p = await getProduct(id);
  if (!p) return { title: "Produto não encontrado" };
  const description = (p.description?.replace(/\s+/g, " ").trim().slice(0, 155) || `${p.title} por ${formatBRL(p.price_cents)} na Zexi.`);
  const images = p.images[0] ? [{ url: p.images[0].url, alt: p.title }] : undefined;
  return {
    title: p.title,
    description,
    alternates: { canonical: `/produto/${p.id}` },
    // Produto pausado ou sem estoque não deve ser indexado
    robots: p.status === "active" && !p.is_showcase ? undefined : { index: false, follow: true },
    openGraph: { type: "website", title: p.title, description, url: `/produto/${p.id}`, images },
    twitter: { card: "summary_large_image", title: p.title, description, images: images?.map((i) => i.url) },
  };
}

async function Product({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ adicionado?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [p, user] = await Promise.all([getProduct(id), getCurrentUser()]);
  if (!p || (p.status !== "active" && p.stores?.owner_id !== user?.id && !isStaff(user?.roles ?? []))) notFound();
  const own = !!user && p.stores?.owner_id === user.id;
  const available = p.status === "active" && p.stock > 0;

  // Tudo o que depende só do produto sai em paralelo (perguntas, opiniões, reputação e mais produtos da loja)
  const [{ questions }, { summary, reviews }, reputations, sameStore] = await Promise.all([
    p.status === "active" && !p.is_showcase ? getProductQuestions(p.id) : { questions: [] },
    getProductReviews(p.id),
    getStoreReputations(p.stores ? [p.stores.id] : []),
    p.stores ? listProducts({ storeId: p.stores.id, limit: 7 }) : null,
  ]);
  const reputation = p.stores ? reputations.get(p.stores.id) : undefined;
  const more = sameStore ? sameStore.items.filter((x) => x.id !== p.id).slice(0, 6) : [];
  const off = p.compare_at_cents && p.compare_at_cents > p.price_cents ? Math.round((1 - p.price_cents / p.compare_at_cents) * 100) : null;

  const buyBox = (
    <div className="rounded-lg border border-line p-4">
      <p className="text-sm font-semibold text-ink">{available ? "Estoque disponível" : p.is_showcase ? "Em breve" : "Sem estoque"}</p>
      <p className="mt-1 flex items-start gap-2 text-sm text-ink">
        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
        <span>
          <span className="font-semibold text-ink">Envio para todo o Brasil</span>
          <span className="block text-xs text-muted">Frete PAC ou SEDEX calculado pelo seu CEP na finalização da compra.</span>
        </span>
      </p>
      {sp.adicionado && (
        <div className="mt-3">
          <Notice tone="success">
            Adicionado ao carrinho.{" "}
            <Link href="/carrinho" className="font-semibold underline">
              Ver carrinho
            </Link>
          </Notice>
        </div>
      )}
      <div className="mt-4">
        {p.status !== "active" ? (
          <Notice>Este produto está em {p.status === "draft" ? "rascunho" : "pausa"} e só você o vê.</Notice>
        ) : own ? (
          <Notice>Este produto é da sua loja.</Notice>
        ) : p.is_showcase ? (
          <Notice>
            <span data-testid="vitrine-aviso">
              <strong>Demonstração:</strong> produto de vitrine, ainda sem estoque para venda. Em breve na Zexi.
            </span>
          </Notice>
        ) : !available ? (
          <Notice tone="error">Esgotado no momento.</Notice>
        ) : (
          <BuyBox productId={p.id} stock={p.stock} priceCents={p.price_cents} title={p.title} />
        )}
      </div>
      {p.stores && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted">
            Vendido por{" "}
            <Link href={`/loja/${p.stores.slug}`} className="font-semibold text-brand hover:underline">
              {p.stores.name}
            </Link>
          </p>
          <StoreReputation reputation={reputation} compact />
        </div>
      )}
      <ul className="mt-4 space-y-3 text-sm">
        <li className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-navy-2" aria-hidden="true" />
          <span className="text-muted">
            <span className="font-semibold text-brand">Compra Garantida</span>: o valor fica retido e a loja só recebe depois que você confirma a entrega.
          </span>
        </li>
        <li className="flex gap-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-navy-2" aria-hidden="true" />
          <span className="text-muted">Pagamento seguro pelo Pagamento Zexi. Um pagamento só, mesmo comprando de várias lojas.</span>
        </li>
      </ul>
    </div>
  );

  return (
    // No celular sobra espaço no fim para a barra fixa de compra não cobrir o conteúdo
    <div className={available && !own && !p.is_showcase ? "space-y-4 pb-20 md:pb-0" : "space-y-4"}>
      <TrackView
        product={{ id: p.id, title: p.title, imageUrl: p.images[0]?.url ?? null, priceCents: p.price_cents, compareAtCents: p.compare_at_cents }}
      />
      {!p.is_showcase && <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.title,
          description: p.description ?? undefined,
          image: p.images.map((i) => i.url),
          sku: p.id,
          category: p.categories?.name,
          itemCondition: `https://schema.org/${p.condition === "new" ? "NewCondition" : p.condition === "refurbished" ? "RefurbishedCondition" : "UsedCondition"}`,
          offers: {
            "@type": "Offer",
            url: `${site.url}/produto/${p.id}`,
            priceCurrency: "BRL",
            price: (p.price_cents / 100).toFixed(2),
            availability: available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            seller: p.stores ? { "@type": "Organization", name: p.stores.name, url: `${site.url}/loja/${p.stores.slug}` } : undefined,
          },
        }}
      />}
      <nav aria-label="Você está em" className="flex flex-wrap items-center gap-1 text-xs text-muted">
        <Link href="/market" className="text-brand hover:underline">
          Market
        </Link>
        {p.categories && (
          <>
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            <Link href={`/market?categoria=${p.categories.slug}`} className="text-brand hover:underline">
              {p.categories.name}
            </Link>
          </>
        )}
        {p.stores && (
          <span className="ml-auto">
            <Link href={`/loja/${p.stores.slug}`} className="text-brand hover:underline">
              Ver mais da loja
            </Link>
          </span>
        )}
      </nav>

      <div className="rounded-md bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.12)] md:p-6">
        <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <Gallery images={p.images} title={p.title} />
          </div>

          <div>
            <p className="text-xs text-muted">
              {conditionLabel[p.condition]}
              {p.categories ? ` | ${p.categories.name}` : ""}
            </p>
            <h1 className="mt-1 text-xl font-semibold leading-snug text-ink md:text-[22px]">{p.title}</h1>
            {summary && (
              <a href="#avaliacoes" className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted hover:text-brand">
                <span className="text-ink">{ratingText(summary.avg)}</span> <Stars value={summary.avg} />
                <span>({summary.count})</span>
              </a>
            )}
            <div className="mt-4">
              {p.compare_at_cents && off ? <p className="text-sm text-muted line-through">{formatBRL(p.compare_at_cents)}</p> : null}
              <p className="flex flex-wrap items-center gap-3">
                <BigPrice cents={p.price_cents} className="text-[34px] leading-none" />
                {off ? <span className="text-lg font-semibold text-brand">{off}% de desconto</span> : null}
              </p>
              <p className="mt-2 text-sm text-ink">
                Pague com <span className="font-semibold">cartão, Pix ou boleto</span>
              </p>
            </div>
            <p className="mt-4 rounded-md bg-surface px-3 py-2 text-sm text-ink">
              <span className="font-semibold">Comprando de várias lojas?</span> Você paga tudo de uma vez só, num único checkout.
            </p>
            {p.description && (
              <div className="mt-5 hidden md:block">
                <h2 className="text-base font-semibold text-ink">O que você precisa saber sobre este produto</h2>
                <p className="mt-2 line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-muted">{p.description}</p>
                <a href="#descricao" className="mt-1 inline-block text-sm text-brand hover:underline">
                  Ver descrição completa
                </a>
              </div>
            )}
          </div>

          <aside className="space-y-4 md:col-span-2 lg:col-span-1">
            {buyBox}
            <PaymentMethods />
          </aside>
        </div>

        {p.video_url && (
          <div className="mt-6 max-w-3xl">
            <ProductVideo url={p.video_url} title={p.title} />
          </div>
        )}

        {more.length > 0 && p.stores && (
          <section aria-label={`Produtos de ${p.stores.name}`} className="mt-8 border-t border-line pt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Produtos de {p.stores.name}</h2>
              <Link href={`/loja/${p.stores.slug}`} className="text-sm text-brand hover:underline">
                Ver todos
              </Link>
            </div>
            <ul className="grid grid-cols-2 gap-3 [&>*]:min-w-0 sm:grid-cols-3 lg:grid-cols-6">
              {more.map((x) => (
                <li key={x.id}>
                  <MarketProductCard product={x} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section id="descricao" className="mt-8 grid grid-cols-1 gap-8 border-t border-line pt-6 [&>*]:min-w-0 lg:grid-cols-[1fr_300px]">
          <div>
            <h2 className="text-lg font-semibold text-ink">Características do produto</h2>
            <dl className="mt-3 overflow-hidden rounded-md border border-line text-sm">
              {[
                ["Condição", conditionLabel[p.condition]],
                ["Categoria", p.categories?.name ?? "—"],
                ["Vendido por", p.stores?.name ?? "—"],
                ["Estoque", available ? `${p.stock} ${p.stock === 1 ? "unidade" : "unidades"}` : "Esgotado"],
              ].map(([k, v], i) => (
                <div key={k} className={cn("grid grid-cols-[140px_1fr] gap-3 px-3 py-2", i % 2 === 0 && "bg-surface")}>
                  <dt className="font-semibold text-ink">{k}</dt>
                  <dd className="text-ink">{v}</dd>
                </div>
              ))}
            </dl>

            <h2 className="mt-8 flex items-center gap-2 text-lg font-semibold text-ink">
              <PackageCheck className="h-5 w-5 text-brand" aria-hidden="true" /> Descrição
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">{p.description || "A loja ainda não escreveu a descrição deste produto."}</p>
            <Link
              href={`/denunciar?tipo=product&id=${p.id}&next=/produto/${p.id}`}
              className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted hover:text-brand hover:underline"
            >
              <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Denunciar este anúncio
            </Link>
          </div>
        </section>

        {p.status === "active" && !p.is_showcase && (
          <ProductQuestions productId={p.id} questions={questions} canAsk={!own} loggedIn={!!user} />
        )}
        {!p.is_showcase && (
          <ProductReviews summary={summary} reviews={reviews} />
        )}
      </div>
    </div>
  );
}

function PaymentMethods() {
  return (
    <section aria-label="Meios de pagamento" className="rounded-lg border border-line p-4">
      <h2 className="text-base font-semibold text-ink">Meios de pagamento</h2>
      <ul className="mt-3 space-y-3 text-sm">
        <li className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-navy-2" aria-hidden="true" /> Cartão de crédito
        </li>
        <li className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-navy-2" aria-hidden="true" /> Pix
        </li>
        <li className="flex items-center gap-2">
          <Banknote className="h-5 w-5 text-navy-2" aria-hidden="true" /> Boleto bancário
        </li>
      </ul>
      <p className="mt-3 text-xs text-muted">Você paga aqui mesmo na Zexi, em ambiente seguro do Pagamento Zexi.</p>
    </section>
  );
}

export default function Page({ params, searchParams }: PageProps<"/produto/[id]">) {
  return (
    <div className="mx-auto max-w-[1200px] px-2 py-4 sm:px-4 md:py-6">
      <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Product params={params} searchParams={searchParams as Promise<{ adicionado?: string }>} />
      </Suspense>
    </div>
  );
}
