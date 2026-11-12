"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAuction } from "@/lib/auctions/actions";
import { durationOptions } from "@/lib/auctions/format";
import { formatBRL } from "@/lib/format";

const input =
  "h-11 w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-navy-2 focus:ring-2 focus:ring-navy-2/20 aria-[invalid=true]:border-danger";

function FieldErr({ state, n }: { state: { fieldErrors?: Record<string, string[] | undefined> }; n: string }) {
  const e = state.fieldErrors?.[n]?.[0];
  return e ? <p id={`${n}-erro`} className="mt-1 text-sm text-danger">{e}</p> : null;
}

export function AuctionForm({ products }: { products: { id: string; title: string; stock: number; price_cents: number }[] }) {
  const [state, action, pending] = useActionState(createAuction, {});
  const [mode, setMode] = useState<"now" | "scheduled">("now");
  const err = (n: string) => state.fieldErrors?.[n]?.[0];
  const f = (n: string) => ({ id: n, name: n, "aria-invalid": err(n) ? true : undefined, "aria-describedby": `${n}-erro` });

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p>}
      <div>
        <label htmlFor="productId" className="mb-1 block text-sm font-medium text-navy">Produto (lote)</label>
        <select {...f("productId")} defaultValue="" className={input}>
          <option value="" disabled>Escolha…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} — estoque {p.stock} · preço no Market {formatBRL(p.price_cents)}
            </option>
          ))}
        </select>
        <FieldErr state={state} n="productId" />
        <p className="mt-1 text-xs text-muted">Uma unidade fica reservada para o leilão e volta ao estoque se ele terminar sem venda.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="startingPrice" className="mb-1 block text-sm font-medium text-navy">Lance inicial (R$)</label>
          <input {...f("startingPrice")} inputMode="decimal" placeholder="100,00" className={input} />
          <FieldErr state={state} n="startingPrice" />
        </div>
        <div>
          <label htmlFor="increment" className="mb-1 block text-sm font-medium text-navy">Incremento mínimo (R$)</label>
          <input {...f("increment")} inputMode="decimal" placeholder="10,00" className={input} />
          <FieldErr state={state} n="increment" />
        </div>
        <div>
          <label htmlFor="reserve" className="mb-1 block text-sm font-medium text-navy">Reserva (opcional)</label>
          <input {...f("reserve")} inputMode="decimal" placeholder="Sem reserva" className={input} />
          <FieldErr state={state} n="reserve" />
        </div>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-navy">Início</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="startMode" value="now" checked={mode === "now"} onChange={() => setMode("now")} className="accent-brand" /> Agora
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="startMode" value="scheduled" checked={mode === "scheduled"} onChange={() => setMode("scheduled")} className="accent-brand" /> Programar
          </label>
        </div>
        {mode === "scheduled" && (
          <div className="mt-2 sm:w-72">
            <label htmlFor="startsAt" className="sr-only">Data e hora de início (horário de Brasília)</label>
            <input {...f("startsAt")} type="datetime-local" className={input} />
            <p className="mt-1 text-xs text-muted">Horário de Brasília.</p>
            <FieldErr state={state} n="startsAt" />
          </div>
        )}
      </fieldset>
      <div className="sm:w-60">
        <label htmlFor="duration" className="mb-1 block text-sm font-medium text-navy">Duração</label>
        <select {...f("duration")} defaultValue="1440" className={input}>
          {durationOptions.map((o) => (
            <option key={o.minutes} value={o.minutes}>{o.label}</option>
          ))}
        </select>
        <FieldErr state={state} n="duration" />
      </div>
      <p className="rounded-xl bg-navy-soft px-4 py-3 text-sm text-navy">
        Lances nos últimos 2 minutos prorrogam o fim em 2 minutos (até 10 vezes). Leilão com lance não pode ser cancelado.
      </p>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Abrir leilão
      </Button>
    </form>
  );
}
