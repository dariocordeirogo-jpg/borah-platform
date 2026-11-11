import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, Notice } from "@/components/market";
import { Button } from "@/components/ui/button";
import { actOnReport } from "@/lib/admin/actions";
import { reportActionLabel, reportKindLabel, reportReasons, type ReportKind, type ReportReason } from "@/lib/admin/format";
import { getOpenReports } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Denúncias", robots: { index: false } };
type SP = { erro?: string; ok?: string };

function targetHref(kind: ReportKind, id: string): string | null {
  switch (kind) {
    case "product":
      return `/produto/${id}`;
    case "live":
      return `/live/${id}`;
    case "video":
      return "/admin/moderacao";
    default:
      return null;
  }
}

async function Reports({ searchParams }: { searchParams: Promise<SP> }) {
  const [reports, sp] = await Promise.all([getOpenReports(), searchParams]);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Denúncias</h1>
      {sp.erro && <Notice tone="error">{sp.erro}</Notice>}
      {sp.ok && <Notice tone="success">Denúncia tratada.</Notice>}
      {!reports.length ? (
        <EmptyState title="Nenhuma denúncia aberta">Quando alguém denunciar um produto, vídeo, live, loja ou mensagem, aparece aqui.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => {
            const href = targetHref(r.kind, r.target_id);
            return (
              <li key={r.id} className="space-y-3 rounded-[var(--radius-card)] border border-line bg-white p-4" data-testid="denuncia">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="rounded-full bg-navy-soft px-2.5 py-0.5 text-xs font-semibold text-navy">{reportKindLabel[r.kind]}</span>{" "}
                    <strong className="text-navy">{reportReasons[r.reason as ReportReason] ?? r.reason}</strong>
                  </span>
                  <span className="text-xs text-muted">{new Date(r.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                </div>
                {r.details && <p className="text-sm text-ink">“{r.details}”</p>}
                <p className="text-xs text-muted">
                  Item: {href ? <Link href={href} className="text-brand hover:underline">{r.target_id}</Link> : r.target_id}
                </p>
                <form action={actOnReport} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="reportId" value={r.id} />
                  <input type="hidden" name="kind" value={r.kind} />
                  <input type="hidden" name="targetId" value={r.target_id} />
                  <input
                    name="reason"
                    maxLength={300}
                    placeholder="Motivo / observação"
                    aria-label="Motivo da decisão"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-line px-3 text-sm"
                  />
                  <Button type="submit" name="decision" value="act" size="sm">
                    {reportActionLabel[r.kind]}
                  </Button>
                  <Button type="submit" name="decision" value="dismiss" size="sm" variant="outline">
                    Descartar
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/admin/denuncias">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
      <Reports searchParams={searchParams as Promise<SP>} />
    </Suspense>
  );
}
