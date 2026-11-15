import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Não foi possível entrar", robots: { index: false } };

const reasons: Record<string, { title: string; text: string }> = {
  expirado: {
    title: "Este link expirou",
    text: "Os links enviados por e-mail valem por pouco tempo e só podem ser usados uma vez. Faça o cadastro de novo com o mesmo e-mail ou use “Esqueci minha senha” para receber um link novo.",
  },
  cancelado: { title: "Login cancelado", text: "O acesso com Google foi cancelado. Você pode tentar de novo ou entrar com e-mail e senha." },
  google: {
    title: "Login com Google indisponível",
    text: "O acesso com Google está temporariamente fora do ar. Entre com e-mail e senha ou crie uma conta.",
  },
  link: {
    title: "Não foi possível concluir o acesso",
    text: "O link pode ter expirado ou já ter sido usado. Se você confirmou a conta em outro aparelho, é só entrar com seu e-mail e senha.",
  },
};

async function Message({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const { motivo } = await searchParams;
  const r = reasons[motivo ?? ""] ?? reasons.link;
  return (
    <>
      <h1 className="mt-4 font-display text-2xl font-bold text-navy">{r.title}</h1>
      <p className="mt-3 text-muted">{r.text}</p>
    </>
  );
}

export default function Page({ searchParams }: PageProps<"/auth/erro">) {
  return (
    <section className="mx-auto max-w-md px-4 py-20 text-center">
      <AlertTriangle className="mx-auto h-12 w-12 text-brand" aria-hidden="true" />
      <Suspense fallback={<div className="h-24" />}>
        <Message searchParams={searchParams as Promise<{ motivo?: string }>} />
      </Suspense>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <ButtonLink href="/entrar">Ir para o login</ButtonLink>
        <ButtonLink href="/recuperar-senha" variant="outline">
          Esqueci minha senha
        </ButtonLink>
      </div>
    </section>
  );
}
