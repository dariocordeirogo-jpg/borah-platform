import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth-forms";
import { googleLoginEnabled } from "@/lib/auth-providers";
import { safeNextPath } from "@/lib/validation";

export const metadata: Metadata = { title: "Entrar" };

async function Form({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const [{ next }, google] = await Promise.all([searchParams, googleLoginEnabled()]);
  return <SignInForm next={safeNextPath(Array.isArray(next) ? next[0] : next)} google={google} />;
}

export default function Page({ searchParams }: PageProps<"/entrar">) {
  return (
    <>
      <h1 className="mt-4 text-center font-display text-2xl font-bold">Entrar na Zexi</h1>
      <p className="mb-6 mt-1 text-center text-sm text-muted">Acesse sua conta para comprar, assistir e dar lances.</p>
      <Suspense fallback={<div className="h-80" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </>
  );
}
