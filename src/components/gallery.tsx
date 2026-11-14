"use client";

import { useState } from "react";
import { ProductImage } from "@/components/market";
import { cn } from "@/lib/utils";

/** Galeria do produto: miniaturas na vertical (desktop) ou embaixo (celular), como nos grandes marketplaces. */
export function Gallery({ images, title }: { images: { id: string; url: string }[]; title: string }) {
  const [active, setActive] = useState(0);
  const current = images[active];
  return (
    <div className="flex flex-col gap-3 md:flex-row-reverse md:items-start">
      <div className="min-w-0 flex-1">
        <ProductImage src={current?.url ?? null} alt={title} priority sizes="(max-width: 768px) 100vw, 45vw" className="rounded-md bg-white" />
      </div>
      {images.length > 1 && (
        <ul className="scrollbar-none flex gap-2 overflow-x-auto md:max-h-[480px] md:flex-col md:overflow-y-auto md:overflow-x-visible" aria-label="Fotos do produto">
          {images.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                aria-label={`Foto ${i + 1}`}
                aria-current={i === active}
                className={cn(
                  "block w-14 overflow-hidden rounded-md border-2 bg-white",
                  i === active ? "border-brand" : "border-line hover:border-navy-2",
                )}
              >
                <ProductImage src={img.url} alt="" sizes="56px" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
