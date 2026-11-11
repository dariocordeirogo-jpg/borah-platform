import type { Metadata } from "next";
import Link from "next/link";
import { aiConfigured } from "@/lib/ai/claude";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { deleteProductImage } from "@/app/seller/actions";
import { Notice, ProductImage } from "@/components/market";
import { ImageUploadForm, ProductForm } from "@/components/seller-forms";
import { Button } from "@/components/ui/button";
import { MAX_IMAGES_PER_PRODUCT } from "@/lib/market/images";
import { getCategories, getSellerProduct } from "@/lib/market/queries";
import { requireStore } from "@/lib/market/seller-guard";

export const metadata: Metadata = { title: "Editar produto" };

async function Edit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criado?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const store = await requireStore(`/seller/produtos/${id}`);
  const [product, categories] = await Promise.all([getSellerProduct(store.id, id), getCategories()]);
  if (!product) notFound();
  return (
    <div className="space-y-6">
      {sp.criado && <Notice tone="success">Produto criado. Agora envie as fotos.</Notice>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy">{product.title}</h1>
        <Link href={`/produto/${product.id}`} className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
          Ver página do produto <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <section className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-3 font-semibold text-navy">
          Fotos ({product.images.length}/{MAX_IMAGES_PER_PRODUCT})
        </h2>
        {product.images.length > 0 && (
          <ul className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {product.images.map((img, i) => (
              <li key={img.id} className="space-y-1">
                <ProductImage src={img.url} alt={`Foto ${i + 1}`} sizes="120px" className="rounded-lg border border-line" />
                <form action={deleteProductImage}>
                  <input type="hidden" name="imageId" value={img.id} />
                  <input type="hidden" name="productId" value={product.id} />
                  <Button type="submit" variant="ghost" size="sm" className="w-full text-xs" aria-label={`Remover foto ${i + 1}`}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remover
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <ImageUploadForm productId={product.id} remaining={MAX_IMAGES_PER_PRODUCT - product.images.length} />
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-3 font-semibold text-navy">Dados do produto</h2>
        <ProductForm product={product} categories={categories} aiEnabled={aiConfigured()} />
      </section>
    </div>
  );
}

export default function Page({ params, searchParams }: PageProps<"/seller/produtos/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
      <Edit params={params} searchParams={searchParams as Promise<{ criado?: string }>} />
    </Suspense>
  );
}
