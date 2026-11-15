import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/validation";

export const metadata: Metadata = { title: "E-mail confirmado", robots: { index: false } };

async function Welcome({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const first = user?.displayName.split(" ")[0];
  return (
    <>
      <h1 className="mt-4 font-display text-2xl font-bold text-navy">E-mail confirmado{first ? `, ${first}` : ""}!</h1>
      <p className="mt-2 text-muted">Sua conta na Zexi está ativa. Agora é só aproveitar.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <ButtonLink href={user ? safeNextPath(next) : "/entrar"}>{user ? "Ir para minha conta" : "Entrar na Zexi"}</ButtonLink>
        <ButtonLink href="/ofertas" variant="outline">
          Ver ofertas
        </ButtonLink>
      </div>
    </>
  );
}

export default function Page({ searchParams }: PageProps<"/auth/confirmado">) {
  return (
    <section className="mx-auto max-w-md px-4 py-20 text-center" data-testid="email-confirmado">
      <CheckCircle2 className="mx-auto h-14 w-14 text-success" aria-hidden="true" />
      <Suspense fallback={<div className="h-40" />}>
        <Welcome searchParams={searchParams as Promise<{ next?: string }>} />
      </Suspense>
    </section>
  );
}
