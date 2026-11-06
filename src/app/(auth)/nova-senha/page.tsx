import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NewPasswordForm } from "@/components/auth-forms";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false } };

/** Só abre com a sessão criada pelo link do e-mail de recuperação. */
async function Guard() {
  const user = await getCurrentUser();
  if (!user) redirect("/recuperar-senha");
  return <NewPasswordForm />;
}

export default function Page() {
  return (
    <>
      <h1 className="mt-4 text-center font-display text-2xl font-bold">Crie uma nova senha</h1>
      <p className="mb-6 mt-1 text-center text-sm text-muted">Depois de salvar, você continua conectado.</p>
      <Suspense fallback={<div className="h-56" />}>
        <Guard />
      </Suspense>
    </>
  );
}
