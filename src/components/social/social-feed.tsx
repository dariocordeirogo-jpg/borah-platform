"use client";

import { useEffect, useState } from "react";
import { platformLabel, socialResultLabel } from "@/lib/social/format";
import type { SocialEvent } from "@/lib/social/queries";
import { getBrowserClient } from "@/lib/supabase/client";

/**
 * Comentários da live no TikTok/Instagram espelhados na Zexi, com o resultado de cada comando.
 * Só existe enquanto a live está no ar: quando ela termina, o banco apaga tudo.
 */
export function SocialFeed({ liveId, initial, platforms }: { liveId: string; initial: SocialEvent[]; platforms: ("tiktok" | "instagram")[] }) {
  const [events, setEvents] = useState<SocialEvent[]>(initial);

  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`live-social-${liveId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_social_events", filter: `live_id=eq.${liveId}` }, (p) => {
        const e = p.new as SocialEvent;
        setEvents((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev.slice(-49), e]));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [liveId]);

  return (
    <section aria-label="Comentários das redes" className="rounded-[var(--radius-card)] border border-line bg-white" data-testid="espelho-redes">
      <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-navy">
        Ao vivo também no {platforms.map((p) => platformLabel[p]).join(" e ")}
      </h2>
      <p className="px-4 pt-3 text-xs text-muted">
        Comente <strong>lance 150</strong> para dar lance ou <strong>eu quero</strong> para levar o produto em destaque.
        Vincule seu @ em <a href="/conta/redes" className="text-brand hover:underline">Minha conta → TikTok e Instagram</a>.
      </p>
      <ol className="max-h-64 space-y-1.5 overflow-y-auto px-4 py-3 text-sm">
        {events.length === 0 && <li className="text-muted">Os comentários das redes aparecem aqui.</li>}
        {events.map((e) => (
          <li key={e.id}>
            <span className="mr-1 rounded bg-navy-soft px-1.5 py-0.5 text-[10px] font-bold text-navy">{platformLabel[e.platform]}</span>
            <strong className="text-navy">{e.nickname}</strong> <span>{e.body}</span>
            {e.result && e.kind !== "comment" && <span className="ml-1 text-xs text-muted">({socialResultLabel[e.result] ?? e.result})</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
