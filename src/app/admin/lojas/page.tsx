import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ReasonForm } from "@/components/admin/reason-form";
import { Notice } from "@/components/market";
import { setStoreActive } from "@/lib/admin/actions";
import { getStores } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Lojas", robots: { index: false } };
type SP = { erro?: string; ok?: string };

async function Stores({ searchParams }: { searchParams: Promise<SP> }) {
  const [stores, sp] = await Promise.all([getStores(), searchParams]);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Lojas</h1>
      {sp.erro && <Notice tone="error">{sp.erro}</Notice>}
      {sp.ok && <Notice tone="success">Feito. A ação ficou registrada na auditoria.</Notice>}
      <p className="text-sm text-muted">Suspender tira a loja, os produtos, os vídeos e as lives do ar. Só admin geral e de operações.</p>
      <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
        {stores.map((s) => (
          <li key={s.id} className="space-y-2 p-4 text-sm" data-testid="loja-admin">
            <p className="flex flex-wrap items-center gap-2">
              <Link href={`/loja/${s.slug}`} className="font-semibold text-navy hover:underline">{s.name}</Link>
              <span className={s.is_active ? "rounded-full bg-navy-soft px-2 py-0.5 text-xs font-semibold text-navy" : "rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-danger"}>
                {s.is_active ? "Ativa" : "Suspensa"}
              </span>
              <span className="text-xs text-muted">desde {new Date(s.created_at).toLocaleDateString("pt-BR")}</span>
            </p>
            {s.is_active ? (
              <ReasonForm action={setStoreActive} id={s.id} label="Suspender loja" hidden={{ active: "0" }} />
            ) : (
              <ReasonForm action={setStoreActive} id={s.id} label="Reativar loja" hidden={{ active: "1" }} required={false} variant="primary" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/admin/lojas">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
      <Stores searchParams={searchParams as Promise<SP>} />
    </Suspense>
  );
}
