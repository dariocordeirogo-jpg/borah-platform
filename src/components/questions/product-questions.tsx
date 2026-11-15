import Link from "next/link";
import { CornerDownRight, MessageCircleQuestion } from "lucide-react";
import { AskForm } from "@/components/questions/ask-form";
import { timeAgo } from "@/lib/questions/format";
import type { ProductQuestion } from "@/lib/questions/queries";

/** Seção "Perguntas e respostas" da página do produto. */
export function ProductQuestions({
  productId,
  questions,
  canAsk,
  loggedIn,
}: {
  productId: string;
  questions: ProductQuestion[];
  canAsk: boolean;
  loggedIn: boolean;
}) {
  return (
    <section id="perguntas" aria-label="Perguntas e respostas" className="mt-8 border-t border-line pt-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
        <MessageCircleQuestion className="h-5 w-5 text-brand" aria-hidden="true" /> Perguntas e respostas
      </h2>
      <div className="mt-3 max-w-3xl space-y-5">
        {canAsk &&
          (loggedIn ? (
            <AskForm productId={productId} />
          ) : (
            <p className="text-sm">
              <Link href={`/entrar?next=${encodeURIComponent(`/produto/${productId}#perguntas`)}`} className="font-semibold text-brand hover:underline">
                Entre na sua conta
              </Link>{" "}
              para perguntar ao vendedor.
            </p>
          ))}
        {questions.length === 0 ? (
          <p className="text-sm text-muted">Ninguém perguntou ainda. Tire sua dúvida com a loja.</p>
        ) : (
          <>
            <h3 className="text-sm font-semibold text-ink">Últimas perguntas</h3>
            <ul className="space-y-4" data-testid="lista-perguntas">
              {questions.map((q) => (
                <li key={q.id} className="text-sm">
                  <p className="text-ink">{q.body}</p>
                  {q.answer ? (
                    <p className="mt-1 flex gap-1.5 text-muted">
                      <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        {q.answer} <span className="text-xs">· {timeAgo(q.answered_at ?? q.created_at)}</span>
                      </span>
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted">Sua pergunta · aguardando a resposta da loja</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
