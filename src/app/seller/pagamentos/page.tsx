import type { Metadata } from "next";
import { Suspense } from "react";
import { CircleCheck, CircleAlert, ExternalLink, Wallet } from "lucide-react";
import { EmptyState, Notice } from "@/components/market";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { requireStore } from "@/lib/market/seller-guard";
import { connectPayoutAccount, openPayoutDashboard } from "@/lib/pay/actions";
import { bpsToPercent, paymentStatusLabel, payoutState, payoutStateLabel } from "@/lib/pay/format";
import { getFeeBps, getMyPayoutAccount, getStorePayments } from "@/lib/pay/queries";
import { payAvailable } from "@/lib/pay/stripe";
import { syncPayoutAccount } from "@/lib/pay/sync";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pagamentos" };
type SP = { erro?: string; retorno?: string; refazer?: string };

async function Payments({ searchParams }: { searchParams: Promise<SP> }) {
  const [store, sp] = await Promise.all([requireStore("/seller/pagamentos"), searchParams]);
  // Volta do cadastro na Stripe: lê a situação da conta na hora
  if (sp.retorno) await syncPayoutAccount(store.id);
  const [account, payments, feeBps, available] = await Promise.all([
    getMyPayoutAccount(store.id),
    getStorePayments(store.id),
    getFeeBps(),
    payAvailable(),
  ]);
  const state = payoutState(account);
  const paid = payments.filter((p) => p.status === "succeeded");
  const totals = paid.reduce(
    (acc, p) => ({ gross: acc.gross + p.amount_cents, fee: acc.fee + p.fee_cents, net: acc.net + p.net_cents }),
    { gross: 0, fee: 0, net: 0 },
  );

  return (
    <div className="space-y-4">
      {sp.erro && <Notice tone="error">{sp.erro}</Notice>}
      {sp.refazer && <Notice>O link do cadastro expirou. Clique em “Continuar cadastro” para abrir um novo.</Notice>}
      {!available && <Notice>O LIVELANCE PAY está em configuração. Assim que for liberado, você conecta sua conta aqui.</Notice>}

      <section className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]" aria-label="Conta de recebimento">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-navy">Conta de recebimento</h2>
            <p className="mt-1 text-sm text-muted">
              Os recebimentos passam pela Stripe. Cada venda cai direto na conta da sua loja, já descontada a comissão da
              LIVELANCE{feeBps != null ? ` (${bpsToPercent(feeBps)})` : ""}.
            </p>
          </div>
          <span
            data-testid="estado-recebimento"
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              state === "active" ? "bg-success-soft text-success" : "bg-navy-soft text-navy",
            )}
          >
            {state === "active" ? <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />}
            {payoutStateLabel[state]}
          </span>
        </div>
        {account && account.requirements_due.length > 0 && (
          <p className="mt-3 text-sm text-muted">A Stripe ainda precisa de {account.requirements_due.length} informação(ões) para liberar tudo.</p>
        )}
        {available && (
          <div className="mt-4 flex flex-wrap gap-2">
            {state !== "active" && (
              <form action={connectPayoutAccount}>
                <Button type="submit">
                  <Wallet className="h-4 w-4" aria-hidden="true" /> {state === "none" ? "Conectar conta Stripe" : "Continuar cadastro"}
                </Button>
              </form>
            )}
            {account?.details_submitted && (
              <form action={openPayoutDashboard}>
                <Button type="submit" variant="outline">
                  Abrir painel da Stripe <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </Button>
              </form>
            )}
          </div>
        )}
      </section>

      <dl className="grid grid-cols-3 gap-3">
        {[
          ["Vendas pagas", totals.gross],
          ["Comissão", totals.fee],
          ["Para você", totals.net],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[var(--radius-card)] border border-line bg-white p-4">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-1 font-display text-lg font-bold text-navy">{formatBRL(value as number)}</dd>
          </div>
        ))}
      </dl>

      {!payments.length ? (
        <EmptyState title="Nenhum pagamento ainda">Quando um comprador pagar um pedido da sua loja, ele aparece aqui.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-surface text-left text-xs text-muted">
              <tr>
                <th className="p-3 font-semibold">Pedido</th>
                <th className="p-3 font-semibold">Data</th>
                <th className="p-3 font-semibold">Situação</th>
                <th className="p-3 text-right font-semibold">Valor</th>
                <th className="p-3 text-right font-semibold">Comissão</th>
                <th className="p-3 text-right font-semibold">Para você</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="p-3 font-medium text-navy">#{p.orders?.number}</td>
                  <td className="p-3 text-muted">{new Date(p.paid_at ?? p.created_at).toLocaleString("pt-BR")}</td>
                  <td className="p-3">{paymentStatusLabel[p.status]}</td>
                  <td className="p-3 text-right">{formatBRL(p.amount_cents)}</td>
                  <td className="p-3 text-right text-muted">− {formatBRL(p.fee_cents)}</td>
                  <td className="p-3 text-right font-semibold text-navy">{formatBRL(p.net_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/seller/pagamentos">) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Pagamentos</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Payments searchParams={searchParams as Promise<SP>} />
      </Suspense>
    </div>
  );
}
