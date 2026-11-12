import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Gavel } from "lucide-react";
import { AuctionCardLive } from "@/components/auctions/auction-card";
import { EmptyState } from "@/components/market";
import { ButtonLink } from "@/components/ui/button";
import { listAuctions, type AuctionTab } from "@/lib/auctions/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Leilões online",
  description: "ZEXI LEILÕES: lotes com lance inicial, incremento mínimo, cronômetro oficial e histórico de lances.",
  alternates: { canonical: "/leiloes" },
};

const tabs: { key: AuctionTab; label: string }[] = [
  { key: "andamento", label: "Em andamento" },
  { key: "programados", label: "Programados" },
  { key: "encerrados", label: "Encerrados" },
];

async function List({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const sp = await searchParams;
  const tab = (tabs.find((t) => t.key === sp.aba)?.key ?? "andamento") as AuctionTab;
  const { items, serverNow } = await listAuctions(tab);
  return (
    <>
      <nav aria-label="Situação dos leilões" className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "andamento" ? "/leiloes" : `/leiloes?aba=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold",
              t.key === tab ? "bg-navy text-white" : "border border-line text-navy hover:bg-surface",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {items.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((a) => (
            <li key={a.id} className="flex">
              <div className="w-full">
                <AuctionCardLive a={a} serverNow={serverNow} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={tab === "encerrados" ? "Nenhum leilão encerrado ainda" : tab === "programados" ? "Nenhum leilão programado" : "Nenhum leilão acontecendo agora"}
          action={<ButtonLink href="/vender">Quero leiloar um produto</ButtonLink>}
        >
          Vendedores verificados podem abrir leilões a partir dos produtos da loja.
        </EmptyState>
      )}
    </>
  );
}

export default function Page({ searchParams }: PageProps<"/leiloes">) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-bold text-brand">
            <Gavel className="h-3.5 w-3.5" aria-hidden="true" /> ZEXI LEILÕES
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-navy md:text-3xl">Leilões</h1>
          <p className="text-sm text-muted">Cronômetro oficial, lance validado pelo servidor e prorrogação automática no fim.</p>
        </div>
        <Link href="/leiloes/regras" className="text-sm font-semibold text-brand hover:underline">
          Como funcionam os leilões
        </Link>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <List searchParams={searchParams as Promise<{ aba?: string }>} />
      </Suspense>
    </div>
  );
}
