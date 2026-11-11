import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, Radio } from "lucide-react";
import { EmptyState } from "@/components/market";
import { ButtonLink } from "@/components/ui/button";
import { listLives } from "@/lib/live/queries";

export const metadata: Metadata = {
  title: "Vendas ao vivo",
  description: "LIVELANCE LIVE: transmissões de venda com chat, produtos em destaque e leilões relâmpago.",
  alternates: { canonical: "/ao-vivo" },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

type Card = { id: string; title: string; scheduled_at: string; stores: { name: string; slug: string } | null };

function LiveCard({ l, live }: { l: Card; live: boolean }) {
  return (
    <li>
      <Link
        href={`/live/${l.id}`}
        className="flex h-full flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[var(--shadow-card)] hover:border-navy-2"
      >
        <span
          className={
            live
              ? "inline-flex w-fit items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-white"
              : "inline-flex w-fit items-center gap-1 rounded-full bg-navy-soft px-2.5 py-0.5 text-xs font-semibold text-navy"
          }
        >
          {live ? <Radio className="h-3.5 w-3.5" aria-hidden="true" /> : <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />}
          {live ? "AO VIVO" : when(l.scheduled_at)}
        </span>
        <span className="font-semibold text-navy">{l.title}</span>
        <span className="text-sm text-muted">{l.stores?.name}</span>
      </Link>
    </li>
  );
}

async function Lives() {
  const { live, upcoming } = await listLives();
  if (!live.length && !upcoming.length) {
    return (
      <EmptyState title="Nenhuma live agora" action={<ButtonLink href="/vender">Venda na LIVELANCE</ButtonLink>}>
        As transmissões das lojas aparecem aqui. Tem loja? Programe sua live no painel do vendedor.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-8">
      {live.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-navy">No ar agora</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((l) => (
              <LiveCard key={l.id} l={l} live />
            ))}
          </ul>
        </section>
      )}
      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-navy">Próximas lives</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((l) => (
              <LiveCard key={l.id} l={l} live={false} />
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
        <p className="text-sm font-bold tracking-wider text-brand">LIVELANCE LIVE</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-navy">Vendas ao vivo</h1>
        <p className="mt-1 text-muted">Assista, pergunte no chat, compre o produto em destaque e dispute leilões relâmpago.</p>
      </div>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Lives />
      </Suspense>
    </div>
  );
}
