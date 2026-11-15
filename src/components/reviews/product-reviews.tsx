import { MessageSquareQuote } from "lucide-react";
import { Stars } from "@/components/reviews/stars";
import { timeAgo } from "@/lib/questions/format";
import { ratingText } from "@/lib/reviews/format";
import type { ProductReview, RatingSummary } from "@/lib/reviews/queries";

/** Seção "Opiniões do produto": média, distribuição de estrelas e comentários de quem comprou. */
export function ProductReviews({ summary, reviews }: { summary: RatingSummary; reviews: ProductReview[] }) {
  return (
    <section id="avaliacoes" aria-label="Opiniões do produto" className="mt-8 border-t border-line pt-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
        <MessageSquareQuote className="h-5 w-5 text-brand" aria-hidden="true" /> Opiniões do produto
      </h2>
      {!summary ? (
        <p className="mt-3 text-sm text-muted">Este produto ainda não tem avaliações. Quem compra pela Zexi avalia depois de receber.</p>
      ) : (
        <div className="mt-4 grid gap-6 md:grid-cols-[220px_1fr]">
          <div data-testid="nota-produto">
            <p className="text-5xl font-semibold text-ink">{ratingText(summary.avg)}</p>
            <Stars value={summary.avg} className="mt-1" size="h-5 w-5" />
            <p className="mt-1 text-xs text-muted">
              {summary.count} {summary.count === 1 ? "avaliação" : "avaliações"}
            </p>
            <ul className="mt-3 space-y-1">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = summary.stars[n - 1] ?? 0;
                return (
                  <li key={n} className="flex items-center gap-2 text-xs text-muted">
                    <span className="w-3 text-right">{n}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                      <span className="block h-full rounded-full bg-brand" style={{ width: `${summary.count ? (c / summary.count) * 100 : 0}%` }} />
                    </span>
                    <span className="w-5">{c}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <ul className="space-y-4" data-testid="lista-avaliacoes">
            {reviews.map((r) => (
              <li key={r.id} className="text-sm">
                <p className="flex items-center gap-2">
                  <Stars value={r.rating} size="h-3.5 w-3.5" />
                  <span className="text-xs text-muted">
                    {r.buyer_alias} · {timeAgo(r.created_at)}
                  </span>
                </p>
                {r.comment && <p className="mt-1 text-ink">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
