"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Cronômetro baseado no relógio do SERVIDOR: a diferença entre o relógio do aparelho e o do servidor
 * é medida uma vez e descontada. O fim oficial continua sendo decidido pelo banco.
 */
export function AuctionTimer({
  target,
  serverNow,
  className,
  urgentBelow = 300,
  endedLabel = "Encerrando…",
  onEnd,
}: {
  target: string;
  serverNow: string;
  className?: string;
  urgentBelow?: number;
  endedLabel?: string;
  onEnd?: () => void;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const skew = new Date(serverNow).getTime() - Date.now();
    const end = new Date(target).getTime();
    const tick = () => {
      const left = Math.max(0, Math.floor((end - (Date.now() + skew)) / 1000));
      setRemaining(left);
      if (left === 0) onEnd?.();
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [target, serverNow, onEnd]);

  const urgent = remaining !== null && remaining > 0 && remaining < urgentBelow;
  return (
    <span className={cn("font-mono tabular-nums", urgent && "text-danger", className)} suppressHydrationWarning>
      {remaining === null ? "--:--:--" : remaining === 0 ? endedLabel : formatCountdown(remaining)}
    </span>
  );
}
