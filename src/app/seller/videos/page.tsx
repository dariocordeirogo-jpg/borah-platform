import type { Metadata } from "next";
import { Suspense } from "react";
import { Eye, Heart, Plus } from "lucide-react";
import { EmptyState, Notice } from "@/components/market";
import { Button, ButtonLink } from "@/components/ui/button";
import { requireStore } from "@/lib/market/seller-guard";
import { removeVideo } from "@/lib/videos/actions";
import { compactCount } from "@/lib/videos/format";
import { getSellerVideos } from "@/lib/videos/queries";

export const metadata: Metadata = { title: "Vídeos" };
type SP = { novo?: string; erro?: string };

async function Videos({ searchParams }: { searchParams: Promise<SP> }) {
  const [store, sp] = await Promise.all([requireStore("/seller/videos"), searchParams]);
  const videos = await getSellerVideos(store.id);
  return (
    <div className="space-y-4">
      {sp.novo && <Notice tone="success">Vídeo publicado! Ele já aparece no feed de vídeos.</Notice>}
      {sp.erro && <Notice tone="error">{sp.erro}</Notice>}
      {!videos.length ? (
        <EmptyState title="Nenhum vídeo ainda" action={<ButtonLink href="/seller/videos/novo">Publicar vídeo</ButtonLink>}>
          Mostre o produto em ação: vídeos curtos com o produto marcado aparecem no feed e levam direto à compra.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {videos.map((v) => (
            <li key={v.id} className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
              <video src={v.url} className="aspect-[9/16] w-full bg-black object-cover" muted playsInline preload="metadata" controls />
              <div className="space-y-2 p-3 text-sm">
                <p className="truncate font-semibold text-navy">{v.products?.title}</p>
                <p className="flex gap-3 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {compactCount(v.views_count)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5" aria-hidden="true" /> {compactCount(v.likes_count)}
                  </span>
                </p>
                <form action={removeVideo}>
                  <input type="hidden" name="videoId" value={v.id} />
                  <Button type="submit" variant="outline" size="sm" className="w-full">
                    Tirar do ar
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/seller/videos">) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Vídeos</h1>
        <ButtonLink href="/seller/videos/novo" size="sm">
          <Plus className="h-4 w-4" aria-hidden="true" /> Publicar vídeo
        </ButtonLink>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Videos searchParams={searchParams as Promise<SP>} />
      </Suspense>
    </div>
  );
}
