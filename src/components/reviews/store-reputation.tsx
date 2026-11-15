import { CheckCircle2 } from "lucide-react";
import { levelLabel, reputationBadges, salesLabel, type Reputation } from "@/lib/reviews/format";
import { cn } from "@/lib/utils";

// Termômetro de 5 níveis (status: do vermelho ao verde)
const tones = ["bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-lime-500", "bg-green-600"];
const soft = ["bg-red-100", "bg-orange-100", "bg-yellow-100", "bg-lime-100", "bg-green-100"];

/** Reputação da loja: termômetro, vendas e selos (como nos grandes marketplaces). */
export function StoreReputation({ reputation, compact }: { reputation: Reputation | undefined; compact?: boolean }) {
  const r = reputation ?? { sales: 0, onTimeRate: null, answerRate: null, ratingAvg: null, ratingCount: 0, level: null };
  const badges = reputationBadges(r);
  return (
    <div className="space-y-2" data-testid="reputacao-loja">
      <div className="flex gap-1" role="img" aria-label={r.level ? levelLabel[r.level] : "Loja nova: ainda sem reputação"}>
        {tones.map((t, i) => (
          <span key={t} className={cn("h-1.5 flex-1 rounded-full", r.level === i + 1 ? t : soft[i])} />
        ))}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="font-semibold text-ink">{r.level ? levelLabel[r.level] : "Loja nova"}</span>
        <span>{salesLabel(r.sales)}</span>
        {badges.map((b) => (
          <span key={b} className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" /> {b}
          </span>
        ))}
      </p>
      {!compact && r.ratingAvg !== null && (
        <p className="text-xs text-muted">
          Nota dos compradores: <strong className="text-ink">{r.ratingAvg.toLocaleString("pt-BR")}</strong> ({r.ratingCount}{" "}
          {r.ratingCount === 1 ? "avaliação" : "avaliações"})
        </p>
      )}
    </div>
  );
}
