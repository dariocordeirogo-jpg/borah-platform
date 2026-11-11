import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { BadgeCheck, Gavel, LogOut, Megaphone, Receipt, ShieldAlert, Store } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { getMyVerification } from "@/lib/auctions/queries";
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
  const verification = (await getMyVerification())?.verification;

  return (
    <div className="space-y-6">
      <section className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-white p-5">
        <span className="flex h-14 w-14 bg-brand items-center justify-center rounded-full font-display text-xl font-bold text-white">
          {user.displayName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-bold text-navy">{user.displayName}</h1>
          <p className="truncate text-sm text-muted">{user.email}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {user.roles.map((r) => (
              <li key={r} className="rounded-full bg-navy-soft px-2.5 py-0.5 text-xs font-semibold text-navy">
                {roleLabels[r] ?? r}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-navy-soft p-5">
        <div className="flex items-start gap-3">
          {verification ? (
            <BadgeCheck className="h-6 w-6 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <ShieldAlert className="h-6 w-6 shrink-0 text-brand" aria-hidden="true" />
          )}
          <div className="flex-1">
            <h2 className="font-semibold text-navy">Verificação para dar lances</h2>
            {verification ? (
              <p className="mt-1 text-sm">CPF {verification.cpf_masked} confirmado. Você já pode dar lances nos leilões.</p>
            ) : (
              <p className="mt-1 text-sm">Para participar dos leilões, confirme seu CPF e celular. Leva menos de 1 minuto.</p>
            )}
            <Link href="/conta/verificacao" className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
              {verification ? "Ver ou atualizar dados" : "Confirmar CPF e celular"}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {[
          { icon: Receipt, title: "Meus pedidos", text: "Acompanhe suas compras", href: "/conta/pedidos" },
          user.roles.includes("seller")
            ? { icon: Store, title: "Minha loja", text: "Painel LIVELANCE SELLER", href: "/seller" }
            : { icon: Store, title: "Abrir minha loja", text: "Venda na LIVELANCE", href: "/vender" },
          { icon: Gavel, title: "Meus lances", text: "Leilões em que você participa", href: "/conta/lances" },
          { icon: Megaphone, title: "Minhas indicações", text: "Indique e ganhe comissão", href: user.roles.includes("affiliate") ? "/conta/indicacoes" : "/indique" },
        ].map((c) =>
          c.href ? (
            <Link key={c.title} href={c.href} className="rounded-[var(--radius-card)] border border-line bg-white p-4 hover:border-navy-2">
              <c.icon className="h-6 w-6 text-brand" aria-hidden="true" />
              <p className="mt-2 font-semibold text-navy">{c.title}</p>
              <p className="text-xs text-muted">{c.text}</p>
            </Link>
          ) : (
            <div key={c.title} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
              <c.icon className="h-6 w-6 text-muted" aria-hidden="true" />
              <p className="mt-2 font-semibold text-navy">{c.title}</p>
              <p className="text-xs text-muted">{c.text}</p>
            </div>
          ),
        )}
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
