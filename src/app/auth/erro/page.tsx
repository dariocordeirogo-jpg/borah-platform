import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Não foi possível entrar" };

export default function Page() {
  return (
    <section className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-bold">Não foi possível concluir o acesso</h1>
      <p className="mt-3 text-muted">
        O link pode ter expirado ou já ter sido usado, ou o login com Google foi cancelado. Tente entrar de novo.
      </p>
      <ButtonLink href="/entrar" className="mt-8">
        Ir para o login
      </ButtonLink>
    </section>
  );
}
