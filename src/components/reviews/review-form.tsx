"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactWarning } from "@/components/contact-warning";
import { reviewProduct, type ReviewState } from "@/lib/reviews/actions";
import { cn } from "@/lib/utils";

const labels = ["", "Ruim", "Regular", "Bom", "Muito bom", "Excelente"];

/** Avaliar um produto de um pedido entregue (pode editar dentro do prazo). */
export function ReviewForm({
  orderId,
  productId,
  title,
  initial,
}: {
  orderId: string;
  productId: string;
  title: string;
  initial?: { rating: number; comment: string | null };
}) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(reviewProduct, {});
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const shown = hover || rating;
  return (
    <form action={action} className="space-y-2" aria-label={`Avaliar ${title}`}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating || ""} />
      <fieldset>
        <legend className="text-sm font-semibold text-ink">{initial ? "Sua avaliação" : "O que achou do produto?"}</legend>
        <div className="mt-1 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
              aria-pressed={rating === n}
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              className="rounded p-0.5"
            >
              <Star className={cn("h-7 w-7", n <= shown ? "fill-brand text-brand" : "fill-line text-line")} aria-hidden="true" />
            </button>
          ))}
          <span className="ml-2 text-sm text-muted">{labels[shown]}</span>
        </div>
      </fieldset>
      <label className="sr-only" htmlFor={`comentario-${productId}`}>
        Comentário
      </label>
      <textarea
        id={`comentario-${productId}`}
        name="comment"
        maxLength={1000}
        rows={2}
        defaultValue={initial?.comment ?? ""}
        placeholder="Conte como foi (opcional)"
        className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy-2 focus:ring-2 focus:ring-navy-2/20"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || !rating}>
          {initial ? "Atualizar avaliação" : "Enviar avaliação"}
        </Button>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p role="status" className="text-sm text-success">
            Obrigado! Sua avaliação foi publicada.
          </p>
        )}
      </div>
      {state.contactHidden && <ContactWarning />}
    </form>
  );
}
