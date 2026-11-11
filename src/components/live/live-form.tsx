"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createLive } from "@/lib/live/actions";
import { formatBRL } from "@/lib/format";

const input =
  "h-11 w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-navy-2 focus:ring-2 focus:ring-navy-2/20";

/** Programar uma live: título, descrição, data (horário de Brasília) e produtos. */
export function LiveForm({ products, defaultStart }: { products: { id: string; title: string; price_cents: number }[]; defaultStart: string }) {
  const [state, action, pending] = useActionState(createLive, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-navy">Título</span>
        <input name="title" maxLength={120} required className={input} placeholder="Ex.: Queima de estoque de bolsas" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-navy">Descrição (opcional)</span>
        <textarea name="description" maxLength={1000} rows={3} className={`${input} h-auto py-2`} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-navy">Início (horário de Brasília)</span>
        <input name="scheduledAt" type="datetime-local" required defaultValue={defaultStart} className={input} />
      </label>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-navy">Produtos da live</legend>
        <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
          {products.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface">
                <input type="checkbox" name="productIds" value={p.id} className="h-4 w-4 accent-brand" />
                <span className="flex-1">{p.title}</span>
                <span className="text-muted">{formatBRL(p.price_cents)}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Programar live"}
      </Button>
    </form>
  );
}
