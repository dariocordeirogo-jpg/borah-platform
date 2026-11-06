import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Criar conta" };

export default function Page() {
  return (
    <>
      <h1 className="mt-4 text-center font-display text-2xl font-bold">Crie sua conta</h1>
      <p className="mb-6 mt-1 text-center text-sm text-muted">Uma conta para comprar, vender, assistir lives e dar lances.</p>
      <SignUpForm />
    </>
  );
}
