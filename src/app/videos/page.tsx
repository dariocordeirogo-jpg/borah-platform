import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/market";
import { ButtonLink } from "@/components/ui/button";
import { VideoFeed } from "@/components/videos/feed";
import { getFeed } from "@/lib/videos/queries";

export const metadata: Metadata = {
  title: "Vídeos",
  description: "Vídeos curtos das lojas da Zexi: veja o produto em ação e compre sem sair do vídeo.",
  alternates: { canonical: "/videos" },
};

async function Feed() {
  const { videos, loggedIn } = await getFeed();
  if (!videos.length) {
    return (
      <EmptyState title="Nenhum vídeo ainda" action={<ButtonLink href="/vender">Venda na Zexi</ButtonLink>}>
        Os vídeos das lojas aparecem aqui. Tem loja? Publique o primeiro no painel do vendedor.
      </EmptyState>
    );
  }
  return <VideoFeed videos={videos} loggedIn={loggedIn} />;
}

export default function Page() {
  return (
    <div className="mx-auto max-w-md px-2 py-3 md:py-5">
      <h1 className="sr-only">Vídeos</h1>
      <Suspense fallback={<div className="h-[70dvh] animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Feed />
      </Suspense>
    </div>
  );
}
