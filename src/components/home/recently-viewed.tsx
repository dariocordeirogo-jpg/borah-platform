"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { History } from "lucide-react";
import { ListingCard, Shelf } from "@/components/listing";

/** Histórico de navegação guardado só neste navegador (como "Vistos recentemente" dos grandes marketplaces). */
const KEY = "zexi:vistos";
const MAX = 12;

export type ViewedProduct = { id: string; title: string; imageUrl: string | null; priceCents: number; compareAtCents: number | null };

function raw(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(json: string): ViewedProduct[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Registra a visita na página do produto. Não renderiza nada. */
export function TrackView({ product }: { product: ViewedProduct }) {
  useEffect(() => {
    try {
      const list = [product, ...parse(raw()).filter((x) => x.id !== product.id)].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      /* navegação privada: sem histórico */
    }
  }, [product]);
  return null;
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

/** Vitrine "Vistos recentemente" na home; some quando não há histórico. */
export function RecentlyViewed() {
  const json = useSyncExternalStore(subscribe, raw, () => "[]");
  const items = useMemo(() => parse(json), [json]);

  if (!items.length) return null;
  return (
    <div data-testid="vistos-recentemente">
      <Shelf
        title="Vistos recentemente"
        eyebrow={
          <span className="mb-0.5 inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-brand">
            <History className="h-3.5 w-3.5" aria-hidden="true" /> SEU HISTÓRICO
          </span>
        }
      >
        {items.map((p) => (
          <li key={p.id}>
            <ListingCard href={`/produto/${p.id}`} title={p.title} imageUrl={p.imageUrl} priceCents={p.priceCents} compareAtCents={p.compareAtCents} />
          </li>
        ))}
      </Shelf>
    </div>
  );
}
