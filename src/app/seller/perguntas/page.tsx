import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { EyeOff, MessageCircleQuestion } from "lucide-react";
import { AnswerForm } from "@/components/questions/answer-form";
import { Button } from "@/components/ui/button";
import { requireStore } from "@/lib/market/seller-guard";
import { hideQuestion } from "@/lib/questions/actions";
import { timeAgo } from "@/lib/questions/format";
import { getStoreQuestions } from "@/lib/questions/queries";

export const metadata: Metadata = { title: "Perguntas" };

type Q = Awaited<ReturnType<typeof getStoreQuestions>>["open"][number];

function QuestionCard({ q }: { q: Q }) {
  return (
    <li className="space-y-3 rounded-[var(--radius-card)] border border-line bg-white p-4" data-testid="pergunta-loja">
      {q.product && (
        <Link href={`/produto/${q.product.id}`} className="flex items-center gap-2 text-xs text-muted hover:text-brand">
          {q.product.imageUrl ? (
            <Image src={q.product.imageUrl} alt="" width={32} height={32} className="h-8 w-8 rounded object-cover" />
          ) : null}
          <span className="truncate">{q.product.title}</span>
        </Link>
      )}
      <p className="text-sm text-ink">
        <strong>{q.asker_alias}</strong> · <span className="text-xs text-muted">{timeAgo(q.created_at)}</span>
        <span className="mt-1 block">{q.body}</span>
      </p>
      <AnswerForm questionId={q.id} initial={q.answer} />
      <form action={hideQuestion}>
        <input type="hidden" name="questionId" value={q.id} />
        <Button type="submit" variant="ghost" size="sm" aria-label={`Esconder a pergunta: ${q.body}`}>
          <EyeOff className="h-4 w-4" aria-hidden="true" /> Esconder pergunta
        </Button>
      </form>
    </li>
  );
}

async function Questions() {
  const store = await requireStore("/seller/perguntas");
  const { open, answered } = await getStoreQuestions(store.id);
  return (
    <div className="space-y-6">
      <section aria-label="Sem resposta" className="space-y-3">
        <h2 className="font-semibold text-navy">
          Sem resposta <span className="text-muted">({open.length})</span>
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted">Tudo respondido. Responder rápido conta para a reputação da sua loja.</p>
        ) : (
          <ul className="space-y-3">
            {open.map((q) => (
              <QuestionCard key={q.id} q={q} />
            ))}
          </ul>
        )}
      </section>
      {answered.length > 0 && (
        <section aria-label="Respondidas" className="space-y-3">
          <h2 className="font-semibold text-navy">Respondidas</h2>
          <ul className="space-y-3">
            {answered.map((q) => (
              <QuestionCard key={q.id} q={q} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-navy">
          <MessageCircleQuestion className="h-6 w-6 text-brand" aria-hidden="true" /> Perguntas
        </h1>
        <p className="mt-1 text-sm text-muted">
          Perguntas dos compradores nos seus anúncios. A resposta aparece para todos na página do produto. Telefone, e-mail e links não
          são permitidos.
        </p>
      </div>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Questions />
      </Suspense>
    </div>
  );
}
