import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth-forms";
import { googleLoginEnabled } from "@/lib/auth-providers";

export const metadata: Metadata = { title: "Criar conta" };

async function Form() {
  return <SignUpForm google={await googleLoginEnabled()} />;
}

export default function Page() {
  return (
    <>
      <h1 className="mt-4 text-center font-display text-2xl font-bold">Crie sua conta</h1>
      <p className="mb-6 mt-1 text-center text-sm text-muted">Uma conta para comprar, vender, assistir transmissões e dar lances.</p>
      <Suspense fallback={<div className="h-96" />}>
        <Form />
      </Suspense>
    </>
  );
}
