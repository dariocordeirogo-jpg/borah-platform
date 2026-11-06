import type { Metadata } from "next";
import { ResetRequestForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Recuperar senha", robots: { index: false } };

export default function Page() {
  return (
    <>
      <h1 className="mt-4 text-center font-display text-2xl font-bold">Recuperar senha</h1>
      <p className="mb-6 mt-1 text-center text-sm text-muted">
        Informe seu e-mail e enviamos um link para você criar uma nova senha.
      </p>
      <ResetRequestForm />
    </>
  );
}
