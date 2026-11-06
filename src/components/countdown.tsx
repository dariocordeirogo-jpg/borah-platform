"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Cronômetro de exibição. Nos leilões reais (Fase 3), o horário de fim vem do servidor
 * e é atualizado pelo Realtime; o navegador nunca decide quando o leilão acaba.
 */
export function Countdown({
  endsInSeconds,
  className,
  urgentBelow = 600,
}: {
  endsInSeconds: number;
  className?: string;
  urgentBelow?: number;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const start = Date.now();
    const tick = () => setRemaining(Math.max(0, endsInSeconds - Math.floor((Date.now() - start) / 1000)));
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [endsInSeconds]);

  const urgent = remaining !== null && remaining > 0 && remaining < urgentBelow;
  return (
    <span
      className={cn("font-mono tabular-nums", urgent && "text-danger", className)}
      aria-live="off"
      suppressHydrationWarning
    >
      {remaining === null ? "--:--:--" : formatCountdown(remaining)}
    </span>
  );
}
