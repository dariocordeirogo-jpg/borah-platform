"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ContactWarning } from "@/components/contact-warning";
import { openComplaint, type ComplaintState } from "@/lib/complaints/actions";
import { COMPLAINT_REASONS, reasonLabel } from "@/lib/complaints/format";
import { CONTACT_HINT } from "@/lib/contact/rule";

/** Formulário de reclamação do pedido (o comprador escolhe o motivo e conta o que houve). */
export function ComplaintForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<ComplaintState, FormData>(openComplaint, {});
  if (state.ok) {
    return (
      <div className="space-y-2">
        <p role="status" className="text-sm text-success">
          Reclamação registrada. A loja foi avisada e vai responder pelo pedido.
        </p>
        {state.contactHidden && <ContactWarning />}
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3" aria-label="Abrir reclamação">
      <input type="hidden" name="orderId" value={orderId} />
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-semibold text-ink">O que aconteceu?</legend>
        {COMPLAINT_REASONS.map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" name="reason" value={r} required className="h-4 w-4 accent-brand" />
            {reasonLabel[r]}
          </label>
        ))}
      </fieldset>
      <label htmlFor={`detalhes-${orderId}`} className="block text-sm font-semibold text-ink">
        Conte mais (opcional)
      </label>
      <textarea
        id={`detalhes-${orderId}`}
        name="details"
        maxLength={1000}
        rows={3}
        className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy-2 focus:ring-2 focus:ring-navy-2/20"
      />
      <p className="text-xs text-muted">{CONTACT_HINT}</p>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          Enviar reclamação
        </Button>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
