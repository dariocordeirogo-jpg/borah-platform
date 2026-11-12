"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createCoupon, type CouponFormState } from "@/lib/coupons/actions";

const input = "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm";

export function CouponForm() {
  const [state, action, pending] = useActionState<CouponFormState, FormData>(createCoupon, {});
  const [kind, setKind] = useState<"percent" | "fixed">("percent");
  return (
    <form action={action} className="grid gap-3 rounded-[var(--radius-card)] border border-line bg-white p-5 sm:grid-cols-2">
      <h2 className="font-semibold text-navy sm:col-span-2">Novo cupom</h2>
      <label className="space-y-1 text-sm">
        <span className="font-semibold text-navy">Código</span>
        <input name="code" required maxLength={20} placeholder="BEMVINDO10" className={`${input} uppercase`} autoComplete="off" />
      </label>
      <fieldset className="space-y-1 text-sm">
        <legend className="font-semibold text-navy">Tipo de desconto</legend>
        <div className="flex h-10 items-center gap-4">
          <label className="flex items-center gap-1.5">
            <input type="radio" name="kind" value="percent" checked={kind === "percent"} onChange={() => setKind("percent")} className="accent-brand" />
            Porcentagem
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="kind" value="fixed" checked={kind === "fixed"} onChange={() => setKind("fixed")} className="accent-brand" />
            Valor em R$
          </label>
        </div>
      </fieldset>
      <label className="space-y-1 text-sm">
        <span className="font-semibold text-navy">{kind === "percent" ? "Desconto (%)" : "Desconto (R$)"}</span>
        <input name="value" required inputMode={kind === "percent" ? "numeric" : "decimal"} placeholder={kind === "percent" ? "10" : "20,00"} className={input} />
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-semibold text-navy">Compra mínima (R$, opcional)</span>
        <input name="minSubtotal" inputMode="decimal" placeholder="100,00" className={input} />
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-semibold text-navy">Limite de usos (opcional)</span>
        <input name="maxUses" inputMode="numeric" placeholder="100" className={input} />
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-semibold text-navy">Válido até (opcional)</span>
        <input name="endsAt" type="datetime-local" className={input} />
      </label>
      <p className="text-xs text-muted sm:col-span-2">
        O desconto sai do valor da sua loja e vale só para os seus produtos. Cada comprador usa o cupom uma vez; se o
        pedido for cancelado, o cupom volta a valer para ele.
      </p>
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger sm:col-span-2">
          {state.error}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Criar cupom
        </Button>
      </div>
    </form>
  );
}
