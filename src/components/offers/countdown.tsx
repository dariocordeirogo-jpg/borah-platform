"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { countdown } from "@/lib/offers/format";

/** Contagem regressiva da oferta relâmpago (só exibição; quem encerra a oferta é o banco). */
export function Countdown({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-brand px-2 py-0.5 text-xs font-semibold text-white" data-testid="contagem-oferta">
      <Zap className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Termina em {now === null ? "--:--:--" : countdown(endsAt, now)}</span>
    </span>
  );
}
