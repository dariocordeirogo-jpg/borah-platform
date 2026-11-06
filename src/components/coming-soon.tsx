import { Clock3 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-soft text-gold-ink">
        <Clock3 className="h-7 w-7" aria-hidden="true" />
      </span>
      <p className="mt-5 text-sm font-semibold text-gold-ink">Em breve · {phase}</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-3 text-muted">{description}</p>
      <ButtonLink href="/" className="mt-8">
        Voltar para o início
      </ButtonLink>
    </section>
  );
}
