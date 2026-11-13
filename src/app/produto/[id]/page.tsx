import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Flag, PackageCheck, ShieldCheck, ShoppingCart, Store, Truck } from "lucide-react";
import { Gallery } from "@/components/gallery";
import { ProductVideo } from "@/components/product/product-video";
import { Notice, Price } from "@/components/market";
import { Button } from "@/components/ui/button";
import { isStaff } from "@/lib/admin/format";
import { getCurrentUser } from "@/lib/auth";
import { addToCart } from "@/lib/market/actions";
import { conditionLabel } from "@/lib/market/format";
import { getProduct } from "@/lib/market/queries";

export async function generateMetadata({ params }: PageProps<"/produto/[id]">): Promise<Metadata> {
  const { id } = await params;
  const p = await getProduct(id);
  if (!p) return { title: "Produto não encontrado" };
  return {
    title: p.title,
    description: p.description?.slice(0, 160) ?? `${p.title} na Zexi.`,
    alternates: { canonical: `/produto/${p.id}` },
    openGraph: { title: p.title, images: p.images[0] ? [p.images[0].url] : undefined },
  };
}

async function Product({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ adicionado?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [p, user] = await Promise.all([getProduct(id), getCurrentUser()]);
  if (!p || (p.status !== "active" && p.stores?.owner_id !== user?.id && !isStaff(user?.roles ?? []))) notFound();
  const own = !!user && p.stores?.owner_id === user.id;
  const available = p.status === "active" && p.stock > 0;
  const maxQty = Math.min(p.stock, 10);

  return (
    <div className="grid grid-cols-1 gap-8 [&>*]:min-w-0 md:grid-cols-[1.1fr_1fr]">
      <div className="space-y-4">
        <Gallery images={p.images} title={p.title} />
        <ProductVideo url={p.video_url} title={p.title} />
      </div>
      <div>
        {p.categories && (
          <Link href={`/market?categoria=${p.categories.slug}`} className="text-xs font-semibold text-brand hover:underline">
            {p.categories.name}
          </Link>
        )}
        <h1 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight text-navy md:text-3xl">{p.title}</h1>
        <p className="mt-1 text-sm text-muted">{conditionLabel[p.condition]}</p>

        <div className="mt-4">
          <Price cents={p.price_cents} compareAt={p.compare_at_cents} size="lg" />
        </div>

        {sp.adicionado && (
          <div className="mt-4">
            <Notice tone="success">
              Adicionado ao carrinho.{" "}
              <Link href="/carrinho" className="font-semibold underline">
                Ver carrinho
              </Link>
            </Notice>
          </div>
        )}

        <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[var(--shadow-card)]">
          {p.status !== "active" ? (
            <Notice>Este produto está em {p.status === "draft" ? "rascunho" : "pausa"} e só você o vê.</Notice>
          ) : own ? (
            <Notice>Este produto é da sua loja.</Notice>
          ) : !available ? (
            <Notice tone="error">Esgotado no momento.</Notice>
          ) : (
            <form action={addToCart} className="space-y-3">
              <input type="hidden" name="productId" value={p.id} />
              <div className="flex items-center gap-3">
                <label htmlFor="quantity" className="text-sm font-medium text-navy">
                  Quantidade
                </label>
                <select id="quantity" name="quantity" defaultValue="1" className="h-10 rounded-lg border border-line bg-white px-3 text-sm">
                  {Array.from({ length: maxQty }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-muted">
                  {p.stock} {p.stock === 1 ? "disponível" : "disponíveis"}
                </span>
              </div>
              <Button type="submit" name="buyNow" value="1" variant="buy" size="lg" className="w-full">
                Comprar agora
              </Button>
              <Button type="submit" variant="outline" size="lg" className="w-full">
                <ShoppingCart className="h-5 w-5" aria-hidden="true" /> Adicionar ao carrinho
              </Button>
            </form>
          )}
          <ul className="mt-4 space-y-2 border-t border-line pt-4 text-sm text-muted">
            <li className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-navy-2" aria-hidden="true" /> Frete calculado na integração com transportadoras (em breve)
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-navy-2" aria-hidden="true" /> Pagamento seguro pelo ZEXI PAY
            </li>
            <li className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-navy-2" aria-hidden="true" />
              <Link href={`/denunciar?tipo=product&id=${p.id}&next=/produto/${p.id}`} className="text-muted hover:text-brand hover:underline">
                Denunciar este anúncio
              </Link>
            </li>
          </ul>
        </div>

        {p.stores && (
          <Link
            href={`/loja/${p.stores.slug}`}
            className="mt-4 flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 hover:border-navy-2"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Store className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-xs text-muted">Vendido por</span>
              <span className="block font-semibold text-navy">{p.stores.name}</span>
            </span>
          </Link>
        )}

        {p.description && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy">
              <PackageCheck className="h-5 w-5 text-brand" aria-hidden="true" /> Descrição
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">{p.description}</p>
          </section>
        )}
      </div>
    </div>
  );
}

export default function Page({ params, searchParams }: PageProps<"/produto/[id]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Product params={params} searchParams={searchParams as Promise<{ adicionado?: string }>} />
      </Suspense>
    </div>
  );
}
