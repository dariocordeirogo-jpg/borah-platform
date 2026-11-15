"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { newLinkCode } from "@/lib/social/actions";

/** Gera o código de vínculo e mostra como usar (comentar na live da loja com o próprio @). */
export function LinkCode() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      {code ? (
        <div className="rounded-xl border-2 border-brand bg-white p-4 text-center">
          <p className="text-xs font-semibold text-muted">Seu código (vale 30 minutos, uma vez)</p>
          <p className="mt-1 select-all font-display text-3xl font-bold tracking-widest text-navy" data-testid="codigo-vinculo">
            {code}
          </p>
        </div>
      ) : null}
      {error && (
        <p role="alert" className="text-sm text-brand">
          {error}
        </p>
      )}
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await newLinkCode();
            setError(r.error ?? null);
            if (r.code) setCode(r.code);
          })
        }
      >
        {code ? "Gerar outro código" : "Gerar código de vínculo"}
      </Button>
    </div>
  );
}
