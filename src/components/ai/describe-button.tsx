"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateDescription } from "@/lib/ai/actions";

/**
 * "Escrever com IA": lê título, categoria e condição do formulário, pede um rascunho e coloca no campo
 * de descrição. O vendedor revisa e edita antes de salvar.
 */
export function DescribeWithAI({ productId, enabled }: { productId?: string; enabled: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  if (!enabled) return <p className="text-xs text-muted">Descrição com IA: em configuração.</p>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={(e) => {
          const form = e.currentTarget.form;
          if (!form) return;
          const data = new FormData(form);
          start(async () => {
            const res = await generateDescription({
              productId,
              title: String(data.get("title") ?? ""),
              categoryId: Number(data.get("categoryId")) || null,
              condition: (String(data.get("condition") ?? "new") as "new" | "used" | "refurbished"),
            });
            if (res.error || !res.text) return setMsg({ tone: "err", text: res.error ?? "Não foi possível gerar agora." });
            const field = form.elements.namedItem("description");
            if (field instanceof HTMLTextAreaElement) field.value = res.text;
            setMsg({ tone: "ok", text: "Rascunho pronto. Revise antes de salvar: você é responsável pelo anúncio." });
          });
        }}
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" /> {pending ? "Escrevendo..." : "Escrever com IA"}
      </Button>
      {msg && (
        <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "text-xs text-danger" : "text-xs text-muted"}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
