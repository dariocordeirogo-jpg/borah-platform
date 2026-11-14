"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";

/**
 * Quantas pessoas estão com a live aberta agora (presença do Supabase Realtime).
 * É um número aproximado, só para exibição: não vale para nada que envolva dinheiro.
 * Quem assiste entra na contagem (`track`); o estúdio da loja só observa.
 */
export function ViewerCount({ liveId, track = false, className }: { liveId: string; track?: boolean; className?: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    const key = crypto.randomUUID();
    const channel = supabase.channel(`live-presence-${liveId}`, { config: { presence: { key } } });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ viewer: boolean }>();
        setCount(Object.values(state).filter((metas) => metas.some((m) => m.viewer)).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && track) await channel.track({ viewer: true });
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [liveId, track]);

  if (count === null) return null;
  return (
    <span data-testid="espectadores" className={`inline-flex items-center gap-1 text-xs font-semibold text-muted ${className ?? ""}`}>
      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
      {count} assistindo
    </span>
  );
}
