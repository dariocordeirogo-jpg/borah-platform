"use client";

import { useState } from "react";
import { ProductImage } from "@/components/market";
import { cn } from "@/lib/utils";

export function Gallery({ images, title }: { images: { id: string; url: string }[]; title: string }) {
  const [active, setActive] = useState(0);
  const current = images[active];
  return (
    <div className="space-y-3">
      <ProductImage
        src={current?.url ?? null}
        alt={title}
        priority
        sizes="(max-width: 768px) 100vw, 50vw"
        className="rounded-[var(--radius-card)] border border-line bg-white"
      />
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto" aria-label="Fotos do produto">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Foto ${i + 1}`}
                aria-current={i === active}
                className={cn(
                  "block w-16 overflow-hidden rounded-lg border-2",
                  i === active ? "border-brand" : "border-line hover:border-navy-2",
                )}
              >
                <ProductImage src={img.url} alt="" sizes="64px" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
