import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { ComplaintForm } from "@/components/complaints/complaint-form";
import { Button } from "@/components/ui/button";
import { resolveComplaint } from "@/lib/complaints/actions";
import { reasonLabel, type Complaint } from "@/lib/complaints/format";

/** Reclamação no pedido do comprador: abrir, acompanhar e encerrar. */
export function OrderComplaint({ orderId, complaint, canOpen }: { orderId: string; complaint: Complaint | null; canOpen: boolean }) {
  if (!complaint && !canOpen) return null;
  return (
    <section aria-label="Problema com a compra" className="space-y-3 rounded-[var(--radius-card)] border border-line bg-white p-4" data-testid="reclamacao">
      <h2 className="font-semibold text-navy">Problema com a compra?</h2>
      {!complaint ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-brand">Abrir reclamação</summary>
          <div className="pt-3">
            <ComplaintForm orderId={orderId} />
          </div>
        </details>
      ) : (
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2 font-semibold text-ink">
            {complaint.status === "open" ? (
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
            )}
            {complaint.status === "open" ? "Reclamação aberta" : "Reclamação resolvida"} · {reasonLabel[complaint.reason]}
          </p>
          {complaint.details && <p className="text-muted">{complaint.details}</p>}
          <p className="text-xs text-muted">Aberta em {new Date(complaint.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
          {complaint.status === "open" && (
            <form action={resolveComplaint} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="complaintId" value={complaint.id} />
              <Button type="submit" size="sm" variant="outline">
                O problema foi resolvido
              </Button>
              <span className="text-xs text-muted">Resolver em até 48 horas não pesa na reputação da loja.</span>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
