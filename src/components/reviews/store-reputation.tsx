import { CheckCircle2 } from "lucide-react";
import {
  emptyReputation,
  percent,
  REPUTATION_RULES,
  reputationBadges,
  reputationTitle,
  salesLabel,
  type Reputation,
  type ReputationColor,
} from "@/lib/reviews/format";
import { cn } from "@/lib/utils";

// Termômetro de 3 cores (status): vermelha, amarela e verde
const scale: { color: ReputationColor; on: string; off: string }[] = [
  { color: "red", on: "bg-red-500", off: "bg-red-100" },
  { color: "yellow", on: "bg-yellow-400", off: "bg-yellow-100" },
  { color: "green", on: "bg-green-600", off: "bg-green-100" },
];

/** Reputação da loja: cor (a partir de 5 vendas), vendas, indicadores e selos. */
export function StoreReputation({ reputation, compact }: { reputation: Reputation | undefined; compact?: boolean }) {
  const r = reputation ?? emptyReputation;
  const badges = reputationBadges(r);
  const title = reputationTitle(r);
  return (
    <div className="space-y-2" data-testid="reputacao-loja" data-cor={r.color ?? "nova"}>
      <div
        className="flex gap-1"
        role="img"
        aria-label={r.color ? title : `Loja nova: a reputação começa depois de ${REPUTATION_RULES.minSales} vendas`}
      >
        {scale.map((s) => (
          <span key={s.color} className={cn("h-1.5 flex-1 rounded-full", r.color === s.color ? s.on : r.color ? s.off : "bg-line")} />
        ))}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="font-semibold text-ink">{title}</span>
        <span>{salesLabel(r.sales)}</span>
        {badges.map((b) => (
          <span key={b} className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" /> {b}
          </span>
        ))}
      </p>
      {!compact && !r.color && (
        <p className="text-xs text-muted">A cor da reputação aparece depois das {REPUTATION_RULES.minSales} primeiras vendas.</p>
      )}
      {!compact && r.color && (
        <dl className="grid grid-cols-3 gap-2 text-center text-xs" data-testid="indicadores-reputacao">
          <Indicator label="Reclamações" value={r.complaintRate} limit={REPUTATION_RULES.complaintLimit} />
          <Indicator label="Cancelamentos" value={r.cancelRate} limit={REPUTATION_RULES.cancelLimit} />
          <Indicator label="Envios atrasados" value={r.delayRate} limit={REPUTATION_RULES.delayLimit} />
        </dl>
      )}
      {!compact && r.ratingAvg !== null && (
        <p className="text-xs text-muted">
          Nota dos compradores: <strong className="text-ink">{r.ratingAvg.toLocaleString("pt-BR")}</strong> ({r.ratingCount}{" "}
          {r.ratingCount === 1 ? "avaliação" : "avaliações"})
        </p>
      )}
    </div>
  );
}

function Indicator({ label, value, limit }: { label: string; value: number | null; limit: number }) {
  const over = value !== null && value > limit;
  return (
    <div className="rounded-lg border border-line px-1 py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("font-semibold", over ? "text-danger" : "text-ink")}>{percent(value)}</dd>
    </div>
  );
}
