"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ContactWarning } from "@/components/contact-warning";
import { answerQuestion, type AskState } from "@/lib/questions/actions";

export function AnswerForm({ questionId, initial }: { questionId: number; initial?: string | null }) {
  const [state, action, pending] = useActionState<AskState, FormData>(answerQuestion, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="questionId" value={questionId} />
      <label className="sr-only" htmlFor={`resposta-${questionId}`}>
        Resposta
      </label>
      <textarea
        id={`resposta-${questionId}`}
        name="answer"
        required
        minLength={2}
        maxLength={1000}
        rows={2}
        defaultValue={initial ?? ""}
        placeholder="Escreva a resposta…"
        className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy-2 focus:ring-2 focus:ring-navy-2/20"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {initial ? "Salvar resposta" : "Responder"}
        </Button>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p role="status" className="text-sm text-success">
            Resposta publicada.
          </p>
        )}
      </div>
      {state.contactHidden && <ContactWarning />}
    </form>
  );
}
