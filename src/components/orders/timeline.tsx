import { CheckCircle2, Circle, ExternalLink, XCircle } from "lucide-react";
import { CopyCode } from "@/components/orders/copy-code";
import { carriers, dateTimeBR, isCarrier, stepDates, timelineSteps, type OrderEvent } from "@/lib/orders/delivery";
import { cn } from "@/lib/utils";

type OrderLike = {
  status: "pending_payment" | "paid" | "shipped" | "delivered" | "cancelled";
  carrier: string | null;
  tracking_code: string | null;
  cancelled_reason?: string | null;
  delivery_confirmed_by?: "buyer" | "auto" | null;
  order_events?: OrderEvent[] | null;
};

/** Rastreio: transportadora, código (copiável) e link para acompanhar no site dela. */
export function TrackingInfo({ order }: { order: OrderLike }) {
  if (!order.tracking_code || !isCarrier(order.carrier)) return null;
  const c = carriers[order.carrier];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="text-muted">{c.label}</span>
      <CopyCode code={order.tracking_code} />
      {c.site && (
        <a href={c.site} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">
          Rastrear no site <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

/** Linha do tempo do pedido: compra → pagamento → a caminho → entregue. */
export function OrderTimeline({ order }: { order: OrderLike }) {
  const dates = stepDates(order.order_events ?? []);
  if (order.status === "cancelled") {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-danger" data-testid="linha-do-tempo">
        <XCircle className="h-5 w-5" aria-hidden="true" /> Pedido cancelado
        {order.cancelled_reason ? <span className="font-normal text-muted">· {order.cancelled_reason}</span> : null}
      </p>
    );
  }
  const reached = { pending_payment: 0, paid: 1, shipped: 2, delivered: 3 }[order.status];
  return (
    <ol className="grid grid-cols-4 gap-1" data-testid="linha-do-tempo" aria-label="Andamento do pedido">
      {timelineSteps.map((s, i) => {
        const done = i <= reached;
        return (
          <li key={s.key} className="relative flex flex-col items-center text-center" aria-current={i === reached ? "step" : undefined}>
            {i > 0 && (
              <span aria-hidden="true" className={cn("absolute right-1/2 top-2.5 h-0.5 w-full -translate-x-3", i <= reached ? "bg-brand" : "bg-line")} />
            )}
            <span className="relative z-10 bg-white">
              {done ? <CheckCircle2 className="h-5 w-5 text-brand" aria-hidden="true" /> : <Circle className="h-5 w-5 text-line" aria-hidden="true" />}
            </span>
            <span className={cn("mt-1 text-[11px] font-semibold leading-tight sm:text-xs", done ? "text-navy" : "text-muted")}>
              {s.key === "delivered" && order.delivery_confirmed_by === "auto" ? "Entregue (prazo)" : s.label}
            </span>
            {done && dates[s.key] && <span className="text-[10px] text-muted sm:text-[11px]">{dateTimeBR(dates[s.key])}</span>}
          </li>
        );
      })}
    </ol>
  );
}
