import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { carrierKeys, carriers } from "@/lib/orders/delivery";
import { shipOrder } from "@/lib/orders/actions";

const input = "h-11 w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-navy-2";

/** Loja informa a transportadora e o código de rastreio (também serve para corrigir). */
export function ShipForm({
  orderId,
  orderNumber,
  next,
  carrier,
  code,
}: {
  orderId: string;
  orderNumber: number;
  next: string;
  carrier?: string | null;
  code?: string | null;
}) {
  const editing = Boolean(code);
  return (
    <form action={shipOrder} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto] sm:items-end">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="next" value={next} />
      <label className="text-xs font-medium text-muted">
        Transportadora
        <select name="carrier" defaultValue={carrier ?? "correios"} aria-label={`Transportadora do pedido ${orderNumber}`} className={input}>
          {carrierKeys.map((k) => (
            <option key={k} value={k}>
              {carriers[k].label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-muted">
        Código de rastreio
        <input
          name="trackingCode"
          defaultValue={code ?? ""}
          required
          maxLength={60}
          autoCapitalize="characters"
          placeholder="AA123456789BR"
          aria-label={`Código de rastreio do pedido ${orderNumber}`}
          className={`${input} font-mono uppercase`}
        />
      </label>
      <Button type="submit" variant={editing ? "outline" : "primary"} className="w-full sm:w-auto">
        <Truck className="h-4 w-4" aria-hidden="true" />
        {editing ? "Corrigir código" : "Marcar como enviado"}
      </Button>
    </form>
  );
}
