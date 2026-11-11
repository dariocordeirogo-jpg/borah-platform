import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/market";
import { ButtonLink } from "@/components/ui/button";
import { VideoUploadForm } from "@/components/videos/upload-form";
import { requireStore } from "@/lib/market/seller-guard";
import { getVideoProducts } from "@/lib/videos/queries";

export const metadata: Metadata = { title: "Publicar vídeo" };

async function NewVideo() {
  const store = await requireStore("/seller/videos/novo");
  const products = await getVideoProducts(store.id);
  if (!products.length) {
    return (
      <EmptyState title="Nenhum produto à venda" action={<ButtonLink href="/seller/produtos/novo">Cadastrar produto</ButtonLink>}>
        Todo vídeo marca um produto ativo da sua loja.
      </EmptyState>
    );
  }
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
      <VideoUploadForm storeId={store.id} products={products} />
    </div>
  );
}

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Publicar vídeo</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <NewVideo />
      </Suspense>
    </div>
  );
}
