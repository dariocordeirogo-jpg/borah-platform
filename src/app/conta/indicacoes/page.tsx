import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CopyField, LinkBuilder } from "@/components/affiliates/link-tools";
import { EmptyState, Notice } from "@/components/market";
import { formatBRL } from "@/lib/format";
import { commissionStatusLabel, referralLink } from "@/lib/affiliates/format";
import { getAffiliateDashboard, getAffiliateProgram, getMyAffiliate } from "@/lib/affiliates/queries";
import { getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { bpsToPercent } from "@/lib/pay/format";

export const metadata: Metadata = { title: "Minhas indicações", robots: { index: false } };

async function Dashboard({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=/conta/indicacoes");
  const affiliate = await getMyAffiliate();
  if (!affiliate) redirect("/indique");
  const [d, program, sp] = await Promise.all([getAffiliateDashboard(), getAffiliateProgram(), searchParams]);

  const stats = [
    { label: "Cliques (30 dias)", value: String(d.clicks30d) },
    { label: "Pedidos indicados", value: String(d.orders) },
    { label: "Aguardando pagamento", value: formatBRL(d.pendingCents) },
    { label: "Confirmadas", value: formatBRL(d.confirmedCents) },
  ];

  return (
    <div className="space-y-5">
      {sp.novo && <Notice tone="success">Pronto! Você já pode compartilhar seus links.</Notice>}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Minhas indicações</h1>
        <p className="mt-1 text-sm text-muted">
          Código <span className="font-semibold text-navy" data-testid="codigo-afiliado">{affiliate.code}</span>
          {program ? ` · ${bpsToPercent(program.rate_bps)} por pedido pago · vale por ${program.cookie_days} dias após o clique` : ""}
        </p>
      </div>

      <section className="space-y-4 rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
        <CopyField label="Seu link geral" value={referralLink(env.NEXT_PUBLIC_SITE_URL, affiliate.code)} testId="link-geral" />
        <LinkBuilder code={affiliate.code} siteUrl={env.NEXT_PUBLIC_SITE_URL} />
      </section>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[var(--radius-card)] border border-line bg-white p-4">
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className="mt-1 font-display text-lg font-bold text-navy">{s.value}</dd>
          </div>
        ))}
      </dl>

      {!d.commissions.length ? (
        <EmptyState title="Nenhuma venda indicada ainda">Quando alguém comprar pelo seu link, o pedido aparece aqui.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-surface text-left text-xs text-muted">
              <tr>
                <th className="p-3 font-semibold">Pedido</th>
                <th className="p-3 font-semibold">Data</th>
                <th className="p-3 font-semibold">Situação</th>
                <th className="p-3 text-right font-semibold">Venda</th>
                <th className="p-3 text-right font-semibold">Sua comissão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.commissions.map((c) => (
                <tr key={c.id}>
                  <td className="p-3 font-medium text-navy">#{c.order_number}</td>
                  <td className="p-3 text-muted">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3">{commissionStatusLabel[c.status]}</td>
                  <td className="p-3 text-right">{formatBRL(c.base_cents)}</td>
                  <td className="p-3 text-right font-semibold text-navy">{formatBRL(c.amount_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">O saque das comissões confirmadas será liberado junto com o registro de entrega dos pedidos.</p>
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/conta/indicacoes">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Dashboard searchParams={searchParams as Promise<{ novo?: string }>} />
      </Suspense>
    </div>
  );
}
