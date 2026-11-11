import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgePercent, Link2, ShoppingBag } from "lucide-react";
import { Notice } from "@/components/market";
import { Button, ButtonLink } from "@/components/ui/button";
import { becomeAffiliate } from "@/lib/affiliates/actions";
import { getAffiliateProgram, getMyAffiliate } from "@/lib/affiliates/queries";
import { getCurrentUser } from "@/lib/auth";
import { bpsToPercent } from "@/lib/pay/format";

export const metadata: Metadata = {
  title: "Indique e ganhe",
  description: "Divulgue produtos e leilões da LIVELANCE com o seu link e ganhe comissão pelas vendas.",
  alternates: { canonical: "/indique" },
};

async function Program({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const [program, user, affiliate, sp] = await Promise.all([getAffiliateProgram(), getCurrentUser(), getMyAffiliate(), searchParams]);
  const rate = program ? bpsToPercent(program.rate_bps) : "—";
  const days = program?.cookie_days ?? 30;

  const steps = [
    { icon: Link2, title: "Pegue seu link", text: "Um link geral e links para qualquer produto, leilão ou loja." },
    { icon: ShoppingBag, title: "Compartilhe", text: `Quem clicar e comprar em até ${days} dias conta para você (vale o último link clicado).` },
    { icon: BadgePercent, title: "Ganhe comissão", text: `${rate} do valor de cada pedido pago. Sai da comissão da LIVELANCE: o vendedor recebe o mesmo.` },
  ];

  return (
    <div className="space-y-8">
      {sp.erro && <Notice tone="error">{sp.erro}</Notice>}
      <section className="rounded-[var(--radius-card)] bg-navy p-6 text-white md:p-10">
        <p className="text-sm font-bold tracking-wider text-white/70">INDIQUE E GANHE</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">Ganhe {rate} em cada venda que você indicar</h1>
        <p className="mt-3 max-w-2xl text-white/80">
          Divulgue produtos e leilões da LIVELANCE no WhatsApp, Instagram ou onde quiser. Sem custo e sem precisar ter loja.
        </p>
        <div className="mt-6">
          {affiliate ? (
            <ButtonLink href="/conta/indicacoes" size="lg">
              Abrir meu painel de indicações
            </ButtonLink>
          ) : user ? (
            <form action={becomeAffiliate}>
              <Button type="submit" size="lg">
                Quero indicar e ganhar
              </Button>
            </form>
          ) : (
            <ButtonLink href="/entrar?next=/indique" size="lg">
              Entrar para participar
            </ButtonLink>
          )}
        </div>
      </section>

      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="rounded-[var(--radius-card)] border border-line bg-white p-5">
            <Icon className="h-6 w-6 text-brand" aria-hidden="true" />
            <h2 className="mt-3 font-semibold text-navy">
              {i + 1}. {title}
            </h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </li>
        ))}
      </ol>

      <section className="rounded-[var(--radius-card)] border border-line bg-white p-5 text-sm">
        <h2 className="font-semibold text-navy">Regras</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>Compras feitas por você mesmo com o seu link não geram comissão.</li>
          <li>Indicar produtos da sua própria loja não gera comissão.</li>
          <li>A comissão é confirmada quando o pedido é pago e cancelada se o pedido for cancelado ou reembolsado.</li>
          <li>O saque das comissões confirmadas será liberado junto com o registro de entrega dos pedidos.</li>
        </ul>
        <p className="mt-3 text-muted">
          Dúvidas? Veja os <Link href="/termos" className="text-brand hover:underline">Termos de uso</Link>.
        </p>
      </section>
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/indique">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={<div className="h-72 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Program searchParams={searchParams as Promise<{ erro?: string }>} />
      </Suspense>
    </div>
  );
}
