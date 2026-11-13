"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Vitrine de cards: no celular, grade de 2 colunas com os primeiros itens (como no app de marketplace, nada sai da
 * tela); do tablet em diante, trilho horizontal com setas. Sem JavaScript continua funcionando.
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
          // Celular: grade (2 colunas para produtos, 1 para lives), sem nada cortado na borda da tela.
          // A partir do tablet: trilho horizontal com setas.
          "grid gap-2 md:flex md:snap-x md:snap-mandatory md:gap-3 md:overflow-x-auto md:pb-1 scrollbar-none",
          "md:[&>li]:shrink-0 md:[&>li]:snap-start",
          size === "product"
            ? "grid-cols-2 max-md:[&>li:nth-child(n+5)]:hidden md:[&>li]:w-[23.5%] lg:[&>li]:w-[18.8%]"
            : "grid-cols-1 max-md:[&>li:nth-child(n+3)]:hidden md:[&>li]:w-[48%] lg:[&>li]:w-[32%]",
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
