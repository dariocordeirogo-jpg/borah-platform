import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Notice } from "@/components/market";
import { PayBox } from "@/components/pay/pay-box";
import { OrderStatus } from "@/components/order-status";
import { OrderTimeline, TrackingInfo } from "@/components/orders/timeline";
import { confirmDelivery } from "@/lib/orders/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { formatDays, shippingServiceLabel } from "@/lib/shipping/format";
import { cancelMyOrder } from "@/lib/market/actions";
import { getOrder } from "@/lib/market/queries";
import { syncCheckoutReturn } from "@/lib/pay/sync";

export const metadata: Metadata = { title: "Pedido", robots: { index: false } };

type SP = { novo?: string; erro?: string; pagamento?: string; sessao?: string; recebido?: string };
type Addr = { recipient: string; street: string; number: string; complement: string | null; district: string; city: string; state: string; cep: string };

async function Order({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=/conta/pedidos/${id}`);
  // Volta do Checkout da Stripe: confere a sessão antes de mostrar o pedido
  if (sp.pagamento === "retorno" && sp.sessao) await syncCheckoutReturn(sp.sessao);
  const o = await getOrder(id);
  if (!o || o.buyer_id !== user.id) notFound();
  const a = o.shipping_address as unknown as Addr;

  return (
    <div className="space-y-4">
      {sp.novo && <Notice tone="success">Pedido registrado e estoque reservado. Agora é só pagar.</Notice>}
      {sp.pagamento === "retorno" && o.status === "paid" && <Notice tone="success">Pagamento confirmado! A loja já foi avisada.</Notice>}
      {sp.pagamento === "retorno" && o.status === "pending_payment" && (
        <Notice>Pagamento recebido pela Stripe. A confirmação pode levar alguns instantes (Pix e boleto dependem do banco).</Notice>
      )}
      {sp.pagamento === "cancelado" && <Notice>Pagamento não concluído. Você pode tentar de novo quando quiser.</Notice>}
      {sp.erro && <Notice tone="error">{sp.erro}</Notice>}
      {sp.recebido && <Notice tone="success">Obrigado por confirmar! Esperamos que goste da compra.</Notice>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Pedido #{o.number}</h1>
        <OrderStatus status={o.status} />
      </div>
      <p className="text-sm text-muted">
        {new Date(o.created_at).toLocaleString("pt-BR")} ·{" "}
        <Link href={`/loja/${o.stores?.slug}`} className="text-brand hover:underline">
          {o.stores?.name}
        </Link>
      </p>
      {o.status === "cancelled" && o.cancelled_reason && <Notice>{o.cancelled_reason}</Notice>}

      <section aria-label="Acompanhe sua compra" className="space-y-4 rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[var(--shadow-card)]">
        <h2 className="font-semibold text-navy">Acompanhe sua compra</h2>
        <OrderTimeline order={o} />
        {o.status === "shipped" && (
          <div className="space-y-3 border-t border-line pt-3">
            <TrackingInfo order={o} />
            <form action={confirmDelivery} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="orderId" value={o.id} />
              <Button type="submit">Já recebi</Button>
              <span className="text-xs text-muted">Confirme quando o pacote chegar. Sem confirmação, consideramos entregue 21 dias após o envio.</span>
            </form>
          </div>
        )}
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)]">
        <ul className="divide-y divide-line">
          {o.order_items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 p-4 text-sm">
              <Link href={`/produto/${i.product_id}`} className="text-ink hover:underline">
                {i.quantity}× {i.title}
              </Link>
              <span className="shrink-0 font-semibold text-navy">{formatBRL(i.unit_price_cents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t border-line p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd>{formatBRL(o.subtotal_cents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">
              Frete{o.shipping_service ? ` (${shippingServiceLabel[o.shipping_service]}, até ${formatDays(o.shipping_days ?? 0)})` : ""}
            </dt>
            <dd className={o.shipping_service ? "" : "text-muted"} data-testid="frete-pedido">
              {o.shipping_service ? formatBRL(o.shipping_cents) : "A combinar com a loja"}
            </dd>
          </div>
          {o.discount_cents > 0 && (
            <div className="flex justify-between" data-testid="desconto">
              <dt className="text-muted">Desconto{o.coupon_code ? ` (cupom ${o.coupon_code})` : ""}</dt>
              <dd className="text-navy">− {formatBRL(o.discount_cents)}</dd>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-navy">
            <dt>Total</dt>
            <dd>{formatBRL(o.total_cents)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-white p-4 text-sm">
        <h2 className="font-semibold text-navy">Entrega</h2>
        <p className="mt-1 text-muted">
          {a.recipient} · {a.street}, {a.number}
          {a.complement ? ` – ${a.complement}` : ""} · {a.district} · {a.city}/{a.state} · CEP{" "}
          {a.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}
        </p>
      </section>

      <PayBox orderId={o.id} storeId={o.store_id} status={o.status} totalCents={o.total_cents} />

      {o.status === "pending_payment" && (
        <form action={cancelMyOrder}>
          <input type="hidden" name="orderId" value={o.id} />
          <Button type="submit" variant="outline">
            Cancelar pedido
          </Button>
        </form>
      )}
      <Link href="/conta/pedidos" className="inline-block text-sm font-semibold text-brand hover:underline">
        ← Todos os pedidos
      </Link>
    </div>
  );
}

export default function Page({ params, searchParams }: PageProps<"/conta/pedidos/[id]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Order params={params} searchParams={searchParams as Promise<SP>} />
      </Suspense>
    </div>
  );
}
