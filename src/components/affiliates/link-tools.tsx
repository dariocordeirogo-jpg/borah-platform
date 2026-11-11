"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { referralLink, toInternalPath } from "@/lib/affiliates/format";
import { Button } from "@/components/ui/button";

/** Campo somente leitura com botão de copiar. */
export function CopyField({ label, value, testId }: { label: string; value: string; testId?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-navy">{label}</p>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          aria-label={label}
          data-testid={testId}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-ink"
        />
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Navegador sem permissão: o campo já fica selecionado para copiar à mão
            }
          }}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
    </div>
  );
}

/** Cole o endereço de um produto, leilão ou loja da LIVELANCE e receba o link com o seu código. */
export function LinkBuilder({ code, siteUrl }: { code: string; siteUrl: string }) {
  const [input, setInput] = useState("");
  const path = input ? toInternalPath(input, siteUrl) : null;
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-navy">Endereço de um produto, leilão ou loja</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="livelance.com.br/produto/..."
          className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink placeholder:text-muted"
        />
      </label>
      {input && !path && <p className="text-sm text-danger">Use um endereço da LIVELANCE.</p>}
      {path && <CopyField label="Seu link para essa página" value={referralLink(siteUrl, code, path)} testId="link-gerado" />}
    </div>
  );
}
