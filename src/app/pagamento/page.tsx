import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { z } from "zod";
import { PaymentForm } from "@/components/pay/payment-form";
import { getCurrentUser } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { startCartCheckout } from "@/lib/pay/cart";
import { payErrorMessage } from "@/lib/pay/format";
import { payTestMode } from "@/lib/pay/stripe";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation";

export const metadata: Metadata = { title: "Pagamento", robots: { index: false } };

type SP = { pedidos?: string; voltar?: string };
const ids = z.array(z.uuid()).min(1).max(20);
const withError = (path: string, code: string) => `${path}${path.includes("?") ? "&" : "?"}erro=${encodeURIComponent(payErrorMessage(code))}`;

async function Payment({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const back = safeNextPath(sp.voltar, "/conta/pedidos");
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(`/pagamento?pedidos=${sp.pedidos ?? ""}&voltar=${back}`)}`);
  const orderIds = ids.safeParse((sp.pedidos ?? "").split(",").filter(Boolean));
  if (!orderIds.success) redirect(withError(back, "order_not_found"));

  // Sem pagamento online neste ambiente (em configuração): volta para o pedido, como antes
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) redirect(back);

  // O banco confere que os pedidos são de quem está pagando e calcula o valor; a sessão é reaproveitada se já existir
  const r = await startCartCheckout(await createClient(), user.email ?? undefined, orderIds.data, back);
  if ("error" in r) redirect(r.error === "pay_unavailable" ? back : withError(back, r.error));
  if ("done" in r) redirect(back);
  if ("url" in r) redirect(r.url);

  return (
    <div className="grid gap-6 [&>*]:min-w-0 md:grid-cols-[1fr_320px]">
      <section aria-label="Forma de pagamento" className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 font-semibold text-navy">Como você prefere pagar?</h2>
        <PaymentForm clientSecret={r.clientSecret} publishableKey={publishableKey} amountCents={r.amountCents} />
      </section>
      <aside className="space-y-4">
        <section aria-label="Resumo do pagamento" className="rounded-[var(--radius-card)] border border-line bg-white p-5 text-sm">
          <h2 className="font-semibold text-navy">Resumo</h2>
          <ul className="mt-3 space-y-2">
            {r.orders.map((o) => (
              <li key={o.order_id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate text-muted">
                  Pedido #{o.number} · {o.store_name}
                </span>
                <span className="shrink-0">{formatBRL(o.amount_cents)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex justify-between border-t border-line pt-3 text-base font-bold text-navy">
            <span>Total</span>
            <span data-testid="total-pagamento">{formatBRL(r.amountCents)}</span>
          </p>
          {payTestMode() && (
            <p className="mt-3 rounded-lg bg-navy-soft px-3 py-2 text-xs text-navy" data-testid="pay-teste">
              Pagamentos em fase de testes: nenhuma cobrança real é feita.
            </p>
          )}
        </section>
        <p className="flex gap-2 text-xs text-muted">
          <ShieldCheck className="h-4 w-4 shrink-0 text-navy-2" aria-hidden="true" />
          <span>
            <strong className="text-ink">Compra Garantida:</strong> o valor fica retido e a loja só recebe depois que você confirma a entrega.
          </span>
        </p>
      </aside>
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/pagamento">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
      <h1 className="mb-4 font-display text-2xl font-bold tracking-tight text-navy">Pagamento</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Payment searchParams={searchParams as Promise<SP>} />
      </Suspense>
    </div>
  );
}
