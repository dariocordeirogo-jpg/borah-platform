"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Código de rastreio com botão de copiar. */
export function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-sm font-semibold text-navy" data-testid="codigo-rastreio">
        {code}
      </code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(code).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          });
        }}
        aria-label={done ? "Código copiado" : "Copiar código de rastreio"}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-brand"
      >
        {done ? <Check className="h-4 w-4 text-brand" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      </button>
    </span>
  );
}
