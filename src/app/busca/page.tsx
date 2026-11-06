import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Busca" };

async function Results({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const term = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 100);
  return (
    <ComingSoon
      phase="Fase 2"
      title={term ? `Busca por “${term}”` : "Busca"}
      description="A busca de produtos, leilões e lojas chega junto com o catálogo do Market."
    />
  );
}

export default function Page({ searchParams }: PageProps<"/busca">) {
  return (
    <Suspense>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}
