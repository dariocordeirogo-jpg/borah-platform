"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Trilho horizontal de cards (estilo vitrine): no celular desliza com o dedo e mostra um pedaço do próximo card;
 * no computador aparecem setas. Sem JavaScript continua rolando normalmente.
 */
export function ShelfTrack({ children, label, size = "product" }: { children: React.ReactNode; label: string; size?: "product" | "live" }) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const first = setTimeout(update, 0);
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      clearTimeout(first);
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const go = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.9, behavior: "smooth" });

  return (
    <div className="relative">
      <ul
        ref={ref}
        aria-label={label}
        className={cn(
          "scrollbar-none -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-4 px-4 pb-1 sm:gap-3 md:mx-0 md:scroll-px-0 md:px-0",
          size === "product"
            ? "[&>li]:w-[44%] sm:[&>li]:w-[31%] md:[&>li]:w-[23.5%] lg:[&>li]:w-[18.8%]"
            : "[&>li]:w-[82%] sm:[&>li]:w-[48%] lg:[&>li]:w-[32%]",
          "[&>li]:shrink-0 [&>li]:snap-start",
        )}
      >
        {children}
      </ul>
      {!edges.start && (
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Ver anteriores"
          className="absolute -left-3 top-1/3 z-10 hidden h-11 w-11 items-center justify-center rounded-full bg-white text-brand shadow-[0_2px_10px_rgba(0,0,0,0.18)] hover:bg-surface md:flex"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
        </button>
      )}
      {!edges.end && (
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Ver mais"
          className="absolute -right-3 top-1/3 z-10 hidden h-11 w-11 items-center justify-center rounded-full bg-white text-brand shadow-[0_2px_10px_rgba(0,0,0,0.18)] hover:bg-surface md:flex"
        >
          <ChevronRight className="h-6 w-6" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
