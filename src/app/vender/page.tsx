import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Gavel, Radio, ShoppingBag } from "lucide-react";
import { CreateStoreForm } from "@/components/seller-forms";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getMyStore } from "@/lib/market/queries";

export const metadata: Metadata = {
  title: "Venda na LIVELANCE",
  description: "LIVELANCE SELLER: abra sua loja e venda com preço fixo, ao vivo ou em leilão.",
  alternates: { canonical: "/vender" },
};

async function Gate() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="space-y-3">
        <ButtonLink href="/cadastro" size="lg" className="w-full">
          Criar conta e abrir loja
        </ButtonLink>
        <ButtonLink href="/entrar?next=/vender" variant="outline" size="lg" className="w-full">
          Já tenho conta
        </ButtonLink>
      </div>
    );
  }
  if (await getMyStore()) redirect("/seller");
  return <CreateStoreForm />;
}

export default function Page() {
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-[1.1fr_1fr] md:py-14">
      <div>
        <p className="text-xs font-bold tracking-wider text-brand">LIVELANCE SELLER</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-navy md:text-4xl">
          Abra sua loja e venda do seu jeito.
        </h1>
        <p className="mt-3 text-muted">Cadastre seus produtos uma vez. Hoje você vende no Market; em breve, também ao vivo e em leilão.</p>
        <ul className="mt-6 space-y-3">
          {[
            { icon: ShoppingBag, t: "Market", d: "Preço fixo, estoque e pedidos — disponível agora." },
            { icon: Radio, t: "Ao vivo", d: "Transmissões com produtos fixados — Fase 7." },
            { icon: Gavel, t: "Leilões", d: "Lotes com lance mínimo e cronômetro oficial — Fase 3." },
          ].map((x) => (
            <li key={x.t} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <x.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block font-semibold text-navy">{x.t}</span>
                <span className="block text-sm text-muted">{x.d}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="h-fit rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 font-display text-xl font-bold text-navy">Sua loja</h2>
        <Suspense fallback={<div className="h-64" />}>
          <Gate />
        </Suspense>
      </div>
    </div>
  );
}
