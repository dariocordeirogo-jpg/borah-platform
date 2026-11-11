import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Notice } from "@/components/market";
import { Button } from "@/components/ui/button";
import { reportContent } from "@/lib/admin/actions";
import { isReportKind, reportKindLabel, reportReasons } from "@/lib/admin/format";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/validation";

export const metadata: Metadata = { title: "Denunciar", robots: { index: false } };
type SP = { tipo?: string; id?: string; next?: string; erro?: string; enviado?: string };

async function ReportForm({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next, "/");
  const self = `/denunciar?tipo=${sp.tipo ?? ""}&id=${encodeURIComponent(sp.id ?? "")}&next=${encodeURIComponent(next)}`;
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(self)}`);
  if (!isReportKind(sp.tipo) || !sp.id) {
    return <Notice tone="error">Não encontramos o item para denunciar.</Notice>;
  }
  if (sp.enviado) {
    return (
      <div className="space-y-4">
        <Notice tone="success">Denúncia enviada. Obrigado! A equipe da LIVELANCE vai analisar.</Notice>
        <Link href={next} className="text-sm font-semibold text-brand hover:underline">
          ← Voltar
        </Link>
      </div>
    );
  }
  return (
    <form action={reportContent} className="space-y-4">
      {sp.erro && <Notice tone="error">{sp.erro}</Notice>}
      <input type="hidden" name="kind" value={sp.tipo} />
      <input type="hidden" name="targetId" value={sp.id} />
      <input type="hidden" name="next" value={next} />
      <p className="text-sm text-muted">Você está denunciando: {reportKindLabel[sp.tipo]}.</p>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-navy">Motivo</legend>
        {Object.entries(reportReasons).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input type="radio" name="why" value={k} required className="accent-brand" /> {label}
          </label>
        ))}
      </fieldset>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-navy">Detalhes (opcional)</span>
        <textarea name="details" maxLength={500} rows={3} className="w-full rounded-xl border border-line px-3 py-2 text-sm" />
      </label>
      <Button type="submit">Enviar denúncia</Button>
    </form>
  );
}

export default function Page({ searchParams }: PageProps<"/denunciar">) {
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-4 font-display text-2xl font-bold tracking-tight text-navy">Denunciar</h1>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <ReportForm searchParams={searchParams as Promise<SP>} />
      </Suspense>
    </div>
  );
}
