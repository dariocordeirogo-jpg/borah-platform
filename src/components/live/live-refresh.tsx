"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

/**
 * Quando a loja começa/encerra a live, troca o produto em destaque, coloca o link do vídeo ou abre
 * um leilão relâmpago, a página recarrega os dados do servidor (sem recarregar o navegador).
 */
export function LiveRefresh({ liveId }: { liveId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`live-${liveId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "lives", filter: `id=eq.${liveId}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "auctions", filter: `live_id=eq.${liveId}` }, () => router.refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [liveId, router]);
  return null;
}
