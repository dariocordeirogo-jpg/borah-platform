import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ReasonForm } from "@/components/admin/reason-form";
import { Notice } from "@/components/market";
import { Button } from "@/components/ui/button";
import { endLiveAdmin, removeVideoAdmin, unblockProduct } from "@/lib/admin/actions";
import { getModerationQueue } from "@/lib/admin/queries";
import { liveStatusLabel } from "@/lib/live/format";

export const metadata: Metadata = { title: "Moderação", robots: { index: false } };
type SP = { erro?: string; ok?: string };

async function Queue({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ videos, lives, blocked }, sp] = await Promise.all([getModerationQueue(), searchParams]);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Moderação</h1>
      {sp.erro && <Notice tone="error">{sp.erro}</Notice>}
      {sp.ok && <Notice tone="success">Feito. A ação ficou registrada na auditoria.</Notice>}

      <section className="rounded-[var(--radius-card)] border border-line bg-white" aria-label="Lives">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-navy">Lives no ar e programadas</h2>
        {!lives.length && <p className="p-4 text-sm text-muted">Nenhuma.</p>}
        <ul className="divide-y divide-line">
          {lives.map((l) => (
            <li key={l.id} className="space-y-2 p-4 text-sm">
              <p>
                <Link href={`/live/${l.id}`} className="font-semibold text-navy hover:underline">{l.title}</Link>{" "}
                <span className="text-muted">· {l.stores?.name} · {liveStatusLabel[l.status]}</span>
              </p>
              <ReasonForm action={endLiveAdmin} id={l.id} label={l.status === "live" ? "Encerrar live" : "Cancelar live"} />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-white" aria-label="Vídeos recentes">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-navy">Vídeos recentes</h2>
        {!videos.length && <p className="p-4 text-sm text-muted">Nenhum.</p>}
        <ul className="divide-y divide-line">
          {videos.map((v) => (
            <li key={v.id} className="space-y-2 p-4 text-sm">
              <p>
                <span className="font-semibold text-navy">{v.products?.title}</span> <span className="text-muted">· {v.stores?.name}</span>
                {v.caption && <span className="block text-muted">“{v.caption}”</span>}
              </p>
              <ReasonForm action={removeVideoAdmin} id={v.id} label="Remover vídeo" />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-white" aria-label="Produtos bloqueados">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-navy">Produtos bloqueados</h2>
        {!blocked.length && <p className="p-4 text-sm text-muted">Nenhum.</p>}
        <ul className="divide-y divide-line">
          {blocked.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <span>
                <Link href={`/produto/${p.id}`} className="font-semibold text-navy hover:underline">{p.title}</Link>{" "}
                <span className="text-muted">· {p.stores?.name} · {p.blocked_reason}</span>
              </span>
              <form action={unblockProduct}>
                <input type="hidden" name="id" value={p.id} />
                <Button type="submit" size="sm" variant="outline">
                  Desbloquear
                </Button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/admin/moderacao">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
      <Queue searchParams={searchParams as Promise<SP>} />
    </Suspense>
  );
}
