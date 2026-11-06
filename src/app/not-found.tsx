import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-display text-6xl font-extrabold text-brand">404</p>
      <h1 className="mt-3 text-2xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-muted">O endereço pode ter mudado ou não existe.</p>
      <ButtonLink href="/" className="mt-8">
        Voltar para o início
      </ButtonLink>
    </section>
  );
}
