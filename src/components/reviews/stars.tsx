import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Estrelas de 0 a 5 (meia estrela arredondada para baixo na exibição). */
export function Stars({ value, className, size = "h-4 w-4" }: { value: number; className?: string; size?: string }) {
  const full = Math.floor(value + 0.25);
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value.toLocaleString("pt-BR")} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(size, i <= full ? "fill-brand text-brand" : "fill-line text-line")} aria-hidden="true" />
      ))}
    </span>
  );
}
