import { orderStatusLabel } from "@/lib/market/format";
import type { Enums } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const tone: Record<Enums<"order_status">, string> = {
  pending_payment: "bg-navy-soft text-navy",
  paid: "bg-success-soft text-success",
  shipped: "bg-navy-soft text-navy-2",
  delivered: "bg-success-soft text-success",
  cancelled: "bg-surface-2 text-muted",
};

export function OrderStatus({ status }: { status: Enums<"order_status"> }) {
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", tone[status])}>
      {orderStatusLabel[status]}
    </span>
  );
}
