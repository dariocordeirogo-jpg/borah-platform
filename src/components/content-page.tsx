import Link from "next/link";
import type { ReactNode } from "react";

/** Página de texto (ajuda, institucional): título, introdução e seções. */
export function ContentPage({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <nav aria-label="Caminho" className="text-xs text-muted">
        <Link href="/" className="hover:text-brand">
          Início
        </Link>{" "}
        ›{" "}
        <Link href="/ajuda" className="hover:text-brand">
          Ajuda
        </Link>
      </nav>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy">{title}</h1>
      {intro && <p className="mt-2 text-muted">{intro}</p>}
      <div className="mt-6 space-y-6 text-sm leading-relaxed text-ink/90">{children}</div>
    </article>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-white p-5">
      <h2 className="font-display text-lg font-bold text-navy">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

/** Pergunta frequente que abre e fecha. */
export function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-line bg-white px-4 py-3">
      <summary className="cursor-pointer list-none font-semibold text-navy marker:hidden">
        <span className="mr-2 inline-block text-brand transition-transform group-open:rotate-90">›</span>
        {q}
      </summary>
      <div className="mt-2 space-y-2 pl-5 text-sm text-ink/90">{children}</div>
    </details>
  );
}
