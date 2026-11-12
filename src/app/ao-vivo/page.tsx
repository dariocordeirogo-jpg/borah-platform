import type { Metadata } from "next";
import { Suspense } from "react";
import { LiveCard } from "@/components/listing";
import { EmptyState } from "@/components/market";
import { ButtonLink } from "@/components/ui/button";
import { listLives } from "@/lib/live/queries";

export const metadata: Metadata = {
  title: "Vendas ao vivo",
  description: "ZEXI LIVE: transmissões de venda com chat, produtos em destaque e leilões relâmpago.",
  alternates: { canonical: "/ao-vivo" },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

type Card = { id: string; title: string; scheduled_at: string; stores: { name: string; slug: string } | null };

function Item({ l, live }: { l: Card; live: boolean }) {
  return (
    <li>
      <LiveCard href={`/live/${l.id}`} title={l.title} store={l.stores?.name} live={live} when={live ? undefined : when(l.scheduled_at)} />
    </li>
  );
}

async function Lives() {
  const { live, upcoming } = await listLives();
  if (!live.length && !upcoming.length) {
    return (
      <EmptyState title="Nenhuma live agora" action={<ButtonLink href="/vender">Venda na Zexi</ButtonLink>}>
        As transmissões das lojas aparecem aqui. Tem loja? Programe sua live no painel do vendedor.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-8">
      {live.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-navy">No ar agora</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((l) => (
              <Item key={l.id} l={l} live />
            ))}
          </ul>
        </section>
      )}
      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-navy">Próximas lives</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((l) => (
              <Item key={l.id} l={l} live={false} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <p className="text-sm font-bold tracking-wider text-brand">ZEXI LIVE</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-navy">Vendas ao vivo</h1>
        <p className="mt-1 text-muted">Assista, pergunte no chat, compre o produto em destaque e dispute leilões relâmpago.</p>
      </div>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Lives />
      </Suspense>
    </div>
  );
}
