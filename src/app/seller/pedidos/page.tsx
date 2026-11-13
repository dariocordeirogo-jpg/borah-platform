import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2, Clock, PackageCheck, PackageOpen, ShoppingBag, Truck, XCircle } from "lucide-react";
import { cancelStoreOrder } from "@/app/seller/actions";
import { EmptyState, Notice } from "@/components/market";
import { ShipForm } from "@/components/orders/ship-form";
import { TrackingInfo } from "@/components/orders/timeline";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { dateBR, dateTimeBR } from "@/lib/orders/delivery";
import { getSellerOrders, itemImage, type SellerOrderTab } from "@/lib/market/queries";
import { requireStore } from "@/lib/market/seller-guard";
import { formatDays, shippingServiceLabel } from "@/lib/shipping/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Vendas" };

type SP = { aba?: string; erro?: string; ok?: string; q?: string };
type Addr = { recipient: string; street: string; number: string; complement: string | null; district: string; city: string; state: string; cep: string };

const tabs: { key: SellerOrderTab; label: string; icon: typeof Truck }[] = [
  { key: "enviar", label: "Para enviar", icon: PackageOpen },
  { key: "pagamento", label: "Aguardando pagamento", icon: Clock },
  { key: "transito", label: "Em trânsito", icon: Truck },
  { key: "finalizadas", label: "Finalizadas", icon: CheckCircle2 },
  { key: "canceladas", label: "Canceladas", icon: XCircle },
];
const isTab = (v: unknown): v is SellerOrderTab => tabs.some((t) => t.key === v);

/** Mensagem principal de cada venda (como nas centrais de marketplace). */
const headline: Record<SellerOrderTab, { text: string; tone: string }> = {
  enviar: { text: "Pronta para enviar", tone: "text-brand" },
  pagamento: { text: "Aguardando o pagamento do comprador. Não envie ainda.", tone: "text-navy-2" },
  transito: { text: "A caminho do comprador", tone: "text-navy" },
  finalizadas: { text: "Entregue", tone: "text-success" },
  canceladas: { text: "Venda cancelada. Não envie.", tone: "text-danger" },
};

async function Sales({ searchParams }: { searchParams: Promise<SP> }) {
  const [store, sp] = await Promise.all([requireStore("/seller/pedidos"), searchParams]);
  const tab: SellerOrderTab = isTab(sp.aba) ? sp.aba : "enviar";
  const { orders, counts } = await getSellerOrders(store.id, tab);
  const q = (sp.q ?? "").replace(/\D/g, "");
  const list = q ? orders.filter((o) => String(o.number).includes(q)) : orders;
  const here = `/seller/pedidos?aba=${tab}`;

  return (
    <div className="space-y-4">
      {sp.ok && <Notice tone="success">{sp.ok}</Notice>}
      {sp.erro && <Notice tone="error">{sp.erro}</Notice>}

      {/* Resumo do dia */}
      <section aria-label="Resumo" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { key: "enviar" as const, label: "Para enviar", icon: PackageOpen, strong: true },
          { key: "pagamento" as const, label: "Aguardando pagamento", icon: Clock },
          { key: "transito" as const, label: "Em trânsito", icon: Truck },
          { key: "finalizadas" as const, label: "Finalizadas", icon: PackageCheck },
        ].map((c) => (
          <Link
            key={c.key}
            href={`/seller/pedidos?aba=${c.key}`}
            className={cn(
              "rounded-xl border bg-white p-3 transition-colors hover:border-brand",
              c.strong && counts[c.key] > 0 ? "border-brand" : "border-line",
            )}
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <c.icon className="h-3.5 w-3.5" aria-hidden="true" /> {c.label}
            </span>
            <span className={cn("mt-1 block font-display text-2xl font-bold", c.strong && counts[c.key] > 0 ? "text-brand" : "text-navy")}>
              {counts[c.key]}
            </span>
          </Link>
        ))}
      </section>

      {/* Abas */}
      <nav aria-label="Situação das vendas" className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/seller/pedidos?aba=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold",
              t.key === tab ? "border-brand text-navy" : "border-transparent text-muted hover:text-navy",
            )}
          >
            {t.label}
            <span className={cn("rounded-full px-1.5 text-xs", t.key === tab ? "bg-brand text-white" : "bg-surface-2 text-muted")}>{counts[t.key]}</span>
          </Link>
        ))}
      </nav>

      <form action="/seller/pedidos" className="flex gap-2" role="search">
        <input type="hidden" name="aba" value={tab} />
        <label htmlFor="busca-venda" className="sr-only">
          Buscar venda pelo número
        </label>
        <input
          id="busca-venda"
          name="q"
          inputMode="numeric"
          defaultValue={sp.q}
          placeholder="Buscar pelo número da venda"
          className="h-10 min-w-0 flex-1 rounded-full border border-line bg-white px-4 text-sm outline-none focus:border-navy-2"
        />
        <Button type="submit" variant="outline" size="sm">
          Buscar
        </Button>
      </form>

      {!list.length ? (
        <EmptyState title={q ? "Nenhuma venda com esse número" : `Nada em “${tabs.find((t) => t.key === tab)!.label}”`}>
          {tab === "enviar" ? "Quando um pedido for pago, ele aparece aqui para você enviar." : "As vendas aparecem aqui conforme a situação muda."}
        </EmptyState>
      ) : (
        <ul className="space-y-3" aria-label="Vendas">
          {list.map((o) => {
            const a = o.shipping_address as unknown as Addr;
            const h = headline[tab];
            return (
              <li key={o.id} className="overflow-hidden rounded-xl border border-line bg-white" data-testid={`venda-${o.number}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2 text-xs text-muted">
                  <span className="font-semibold text-navy">Venda #{o.number}</span>
                  <span>{dateTimeBR(o.created_at)}</span>
                  <span className="ml-auto font-medium text-ink">{a.recipient}</span>
                </div>
                <div className="space-y-3 p-4">
                  <p className={cn("font-display text-base font-bold", h.tone)}>
                    {tab === "transito" && o.shipped_at ? `${h.text} · enviado em ${dateBR(o.shipped_at)}` : null}
                    {tab === "finalizadas" && o.delivered_at
                      ? `${h.text} em ${dateBR(o.delivered_at)}${o.delivery_confirmed_by === "auto" ? " (prazo)" : ""}`
                      : null}
                    {tab !== "transito" && tab !== "finalizadas" ? h.text : null}
                  </p>
                  <ul className="space-y-2">
                    {o.order_items.map((i) => {
                      const img = itemImage(i);
                      return (
                        <li key={i.id} className="flex items-center gap-3 rounded-lg bg-surface p-2">
                          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white">
                            {img ? (
                              <Image src={img} alt="" fill sizes="48px" className="object-contain" />
                            ) : (
                              <ShoppingBag className="m-3.5 h-5 w-5 text-muted" aria-hidden="true" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink">{i.title}</span>
                            <span className="text-xs text-muted">
                              {formatBRL(i.unit_price_cents)} · {i.quantity} {i.quantity === 1 ? "unidade" : "unidades"}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {(tab === "enviar" || tab === "transito") && (
                    <div className="rounded-lg border border-dashed border-line p-3 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Enviar para</p>
                      <p className="mt-0.5 text-ink">
                        {a.recipient} · {a.street}, {a.number}
                        {a.complement ? ` – ${a.complement}` : ""} · {a.district} · {a.city}/{a.state} · CEP {a.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}
                      </p>
                      {o.shipping_service && (
                        <p className="mt-0.5 text-xs text-muted">
                          Frete {shippingServiceLabel[o.shipping_service]} pago pelo comprador · prazo informado: até {formatDays(o.shipping_days ?? 0)}
                        </p>
                      )}
                    </div>
                  )}

                  {tab === "transito" && <TrackingInfo order={o} />}

                  <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-3">
                    <p className="text-sm">
                      <span className="text-muted">Total </span>
                      <span className="font-bold text-navy">{formatBRL(o.total_cents)}</span>
                      {o.coupon_code && <span className="ml-2 text-xs text-muted">cupom {o.coupon_code}</span>}
                    </p>
                    {o.status === "pending_payment" && (
                      <form action={cancelStoreOrder}>
                        <input type="hidden" name="orderId" value={o.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Cancelar venda
                        </Button>
                      </form>
                    )}
                  </div>
                  {(o.status === "paid" || o.status === "shipped") && (
                    <ShipForm orderId={o.id} orderNumber={o.number} next={here} carrier={o.carrier} code={o.tracking_code} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/seller/pedidos">) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Vendas</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Sales searchParams={searchParams as Promise<SP>} />
      </Suspense>
    </div>
  );
}
