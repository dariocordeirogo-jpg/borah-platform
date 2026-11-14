import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CreditCard, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { EmptyState, Notice } from "@/components/market";
import { Button, ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { addToCart } from "@/lib/market/actions";
import { getMyOrders, itemImage } from "@/lib/market/queries";
import { carriers, dateBR, isCarrier } from "@/lib/orders/delivery";
import { payCart } from "@/lib/pay/actions";
import { payAvailable } from "@/lib/pay/stripe";
import { syncCheckoutReturn } from "@/lib/pay/sync";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Minhas compras", robots: { index: false } };

type Order = Awaited<ReturnType<typeof getMyOrders>>[number];

function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Linha de status no topo de cada compra (verde = andamento normal). */
function statusLine(o: Order): { text: string; tone: string } {
  switch (o.status) {
    case "pending_payment":
      return { text: "Aguardando pagamento", tone: "text-navy-2" };
    case "paid":
      return {
        text: o.shipping_days ? `Pagamento aprovado · a loja envia em breve (prazo de até ${o.shipping_days} dias úteis)` : "Pagamento aprovado · a loja vai enviar",
        tone: "text-success",
      };
    case "shipped": {
      const eta = o.shipped_at && o.shipping_days ? ` · previsão até ${dateBR(addDays(o.shipped_at, Math.ceil(o.shipping_days * 1.4)))}` : "";
      return { text: `A caminho${eta}`, tone: "text-success" };
    }
    case "delivered":
      return { text: `Entregue${o.delivered_at ? ` em ${dateBR(o.delivered_at)}` : ""}`, tone: "text-ink" };
    case "cancelled":
      return { text: "Compra cancelada", tone: "text-danger" };
  }
}

function PurchaseRow({ o }: { o: Order }) {
  const first = o.order_items[0];
  const img = first ? itemImage(first) : null;
  const s = statusLine(o);
  const more = o.order_items.length - 1;
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center" data-testid={`compra-${o.number}`}>
      <Link href={`/conta/pedidos/${o.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
          {img ? <Image src={img} alt="" fill sizes="64px" className="object-contain" /> : <ShoppingBag className="m-5 h-6 w-6 text-muted" aria-hidden="true" />}
        </span>
        <span className="min-w-0">
          <span className={cn("block text-xs font-semibold", s.tone)}>{s.text}</span>
          <span className="block truncate text-sm font-semibold text-navy">
            {first?.title}
            {more > 0 ? ` e mais ${more}` : ""}
          </span>
          <span className="block text-xs text-muted">
            {o.stores?.name} · compra #{o.number} · {formatBRL(o.total_cents)}
          </span>
          {o.status === "shipped" && o.tracking_code && isCarrier(o.carrier) && (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <Truck className="h-3.5 w-3.5" aria-hidden="true" /> {carriers[o.carrier].label} · {o.tracking_code}
            </span>
          )}
        </span>
      </Link>
      <div className="flex shrink-0 gap-2">
        {o.status === "delivered" && first && (
          <form action={addToCart}>
            <input type="hidden" name="productId" value={first.product_id} />
            <input type="hidden" name="quantity" value="1" />
            <Button type="submit" variant="ghost" size="sm">
              Comprar novamente
            </Button>
          </form>
        )}
        <ButtonLink href={`/conta/pedidos/${o.id}`} variant="outline" size="sm">
          {o.status === "pending_payment" ? "Pagar" : o.status === "shipped" ? "Acompanhar" : "Ver detalhe"}
        </ButtonLink>
      </div>
    </li>
  );
}

function Group({ title, orders, action }: { title: string; orders: Order[]; action?: React.ReactNode }) {
  if (!orders.length) return null;
  return (
    <section aria-label={title}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-navy">{title}</h2>
        {action}
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
        {orders.map((o) => (
          <PurchaseRow key={o.id} o={o} />
        ))}
      </ul>
    </section>
  );
}

type SP = { novo?: string; erro?: string; pagamento?: string; sessao?: string };

/** Paga todos os pedidos pendentes (de várias lojas) numa cobrança só. Dourado só no botão de pagar. */
function PayAll({ orders }: { orders: Order[] }) {
  const total = orders.reduce((s, o) => s + o.total_cents, 0);
  return (
    <form action={payCart}>
      {orders.map((o) => (
        <input key={o.id} type="hidden" name="orderId" value={o.id} />
      ))}
      <Button type="submit" variant="buy" size="sm">
        <CreditCard className="h-4 w-4" aria-hidden="true" />
        {orders.length > 1 ? `Pagar tudo · ${formatBRL(total)}` : `Pagar ${formatBRL(total)}`}
      </Button>
    </form>
  );
}

async function Purchases({ searchParams }: { searchParams: Promise<SP> }) {
  if (!(await getCurrentUser())) redirect("/entrar?next=/conta/pedidos");
  const sp = await searchParams;
  // Volta do Checkout da Stripe: confere a cobrança antes de listar
  if (sp.pagamento === "retorno" && sp.sessao) await syncCheckoutReturn(sp.sessao);
  const [orders, available] = await Promise.all([getMyOrders(), payAvailable()]);
  const next = orders.filter((o) => o.status === "paid" || o.status === "shipped");
  const pending = orders.filter((o) => o.status === "pending_payment");
  const history = orders.filter((o) => o.status === "delivered" || o.status === "cancelled");
  return (
    <div className="space-y-6">
      {sp.novo && <Notice tone="success">Pedidos registrados! Cada loja recebeu o seu pedido.</Notice>}
      {sp.pagamento === "retorno" && (
        <Notice tone="success">
          Pagamento recebido! Os pedidos mudam para “Pago” assim que a confirmação chegar (Pix e boleto dependem do banco).
        </Notice>
      )}
      {sp.pagamento === "cancelado" && <Notice>Pagamento não concluído. Você pode tentar de novo quando quiser.</Notice>}
      {sp.erro && <Notice tone="error">{sp.erro}</Notice>}
      {orders.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-navy-soft px-4 py-3 text-sm text-navy">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Compra Garantida Zexi: você paga uma vez só, mesmo comprando de várias lojas. A loja só recebe depois que você
          confirma a entrega.
        </p>
      )}
      {!orders.length ? (
        <EmptyState title="Você ainda não fez compras" action={<ButtonLink href="/market">Explorar o Market</ButtonLink>} />
      ) : (
        <>
          <Group title="Próximas entregas" orders={next} />
          <Group title="Aguardando pagamento" orders={pending} action={available ? <PayAll orders={pending} /> : undefined} />
          <Group title="Histórico de compras" orders={history} />
        </>
      )}
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/conta/pedidos">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-8">
      <h1 className="mb-4 font-display text-2xl font-bold tracking-tight text-navy">Minhas compras</h1>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Purchases searchParams={searchParams as Promise<SP>} />
      </Suspense>
    </div>
  );
}
