import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BadgeCheck, Lock } from "lucide-react";
import { VerificationForm } from "@/components/auctions/verification-form";
import { Notice } from "@/components/market";
import { formatPhoneBR } from "@/lib/auctions/format";
import { getMyVerification } from "@/lib/auctions/queries";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/validation";

export const metadata: Metadata = { title: "Verificação para lances", robots: { index: false } };

async function Verification({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next, "");
  if (!(await getCurrentUser())) redirect(`/entrar?next=${encodeURIComponent("/conta/verificacao")}`);
  const data = await getMyVerification();
  const v = data?.verification;
  return (
    <div className="space-y-4">
      {data?.block && (
        <Notice tone="error">
          Lances bloqueados até {new Date(data.block.blocked_until).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}: {data.block.reason}.
        </Notice>
      )}
      {v && (
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-4">
          <p className="flex items-center gap-2 font-semibold text-navy">
            <BadgeCheck className="h-5 w-5 text-success" aria-hidden="true" /> Você já pode dar lances
          </p>
          <ul className="mt-2 text-sm text-muted">
            <li>CPF: {v.cpf_masked}</li>
            <li>Celular: {formatPhoneBR(v.phone)} {v.phone_verified_at ? "(confirmado por SMS)" : "(confirmação por SMS chega com o provedor de SMS)"}</li>
          </ul>
          <p className="mt-3 text-xs text-muted">Para trocar o celular, preencha o formulário abaixo de novo.</p>
        </div>
      )}
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
        <VerificationForm next={next.startsWith("/leilao/") ? next : undefined} />
      </div>
      <p className="flex items-start gap-2 text-xs text-muted">
        <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
        Guardamos seu CPF de forma protegida (só aparece mascarado) para garantir uma conta por pessoa nos leilões. Nada é
        compartilhado com outros usuários.
      </p>
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/conta/verificacao">) {
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Verificação para dar lances</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Confirme seu CPF e celular uma única vez.</p>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Verification searchParams={searchParams as Promise<{ next?: string }>} />
      </Suspense>
    </div>
  );
}
