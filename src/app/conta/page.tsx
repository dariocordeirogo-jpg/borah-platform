import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BadgeCheck, Gavel, LogOut, Megaphone, ShieldAlert, Store } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Minha conta" };

const roleLabels: Record<string, string> = {
  buyer: "Comprador",
  seller: "Vendedor",
  affiliate: "Afiliado",
  creator: "Criador",
  admin_super: "Superadministrador",
  admin_finance: "Admin financeiro",
  admin_ops: "Admin operacional",
  moderator: "Moderador",
  support: "Suporte",
  analyst: "Analista",
};

async function Account() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=/conta");

  return (
    <div className="space-y-6">
      <section className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-white p-5">
        <span className="metal-green flex h-14 w-14 items-center justify-center rounded-full font-display text-xl font-bold text-white">
          {user.displayName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-bold">{user.displayName}</h1>
          <p className="truncate text-sm text-muted">{user.email}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {user.roles.map((r) => (
              <li key={r} className="rounded-full bg-green-soft px-2.5 py-0.5 text-xs font-semibold text-green-deep">
                {roleLabels[r] ?? r}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] border border-gold/40 bg-gold-soft p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-6 w-6 shrink-0 text-gold-ink" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Verificação para dar lances</h2>
            <p className="mt-1 text-sm">
              Para participar dos leilões você vai precisar confirmar CPF e telefone. A verificação chega junto com os
              leilões, na Fase 3.
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              <li className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-muted" aria-hidden="true" /> CPF: não verificado
              </li>
              <li className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-muted" aria-hidden="true" /> Telefone: não verificado
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Gavel, title: "Meus lances", text: "Fase 3" },
          { icon: Store, title: "Minha loja", text: "Fase 2" },
          { icon: Megaphone, title: "Minhas indicações", text: "Fase 5" },
        ].map((c) => (
          <div key={c.title} className="rounded-[var(--radius-card)] border border-line bg-white p-4">
            <c.icon className="h-6 w-6 text-green" aria-hidden="true" />
            <p className="mt-2 font-semibold">{c.title}</p>
            <p className="text-xs text-muted">Em breve · {c.text}</p>
          </div>
        ))}
      </section>

      <form action={signOut}>
        <Button type="submit" variant="outline">
          <LogOut className="h-4 w-4" aria-hidden="true" /> Sair da conta
        </Button>
      </form>
    </div>
  );
}

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Account />
      </Suspense>
    </div>
  );
}
