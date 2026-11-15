"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactWarning } from "@/components/contact-warning";
import { CONTACT_HINT } from "@/lib/contact/rule";
import { askQuestion, type AskState } from "@/lib/questions/actions";

/** Caixa de pergunta no produto. A loja recebe o aviso e a resposta aparece aqui para todos. */
export function AskForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState<AskState, FormData>(askQuestion, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="productId" value={productId} />
      <label htmlFor="pergunta" className="block text-sm font-semibold text-ink">
        Pergunte ao vendedor
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <textarea
          id="pergunta"
          name="body"
          required
          minLength={5}
          maxLength={500}
          rows={2}
          placeholder="Escreva sua pergunta…"
          className="min-h-11 w-full flex-1 rounded-xl border border-line bg-white px-3 py-2 text-base outline-none focus:border-navy-2 focus:ring-2 focus:ring-navy-2/20"
        />
        <Button type="submit" disabled={pending} className="sm:self-start">
          <Send className="h-4 w-4" aria-hidden="true" /> Perguntar
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-success">
          Pergunta enviada! Avisamos a loja e a resposta aparece aqui.
        </p>
      )}
      {state.contactHidden && <ContactWarning />}
      <p className="text-xs text-muted">{CONTACT_HINT} Negocie e pague pela Zexi para ter a Compra Garantida.</p>
    </form>
  );
}
