import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, ExternalLink, MessageCircleQuestion, Package, Plus, Receipt, Wallet } from "lucide-react";
import { Notice } from "@/components/market";
import { ButtonLink } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { getSellerStats } from "@/lib/market/queries";
import { requireStore } from "@/lib/market/seller-guard";
import { payoutState, payoutStateLabel } from "@/lib/pay/format";
import { getMyPayoutAccount } from "@/lib/pay/queries";
import { countOpenQuestions } from "@/lib/questions/queries";

async function Dashboard({ searchParams }: { searchParams: Promise<{ bemvindo?: string }> }) {
  const [store, sp] = await Promise.all([requireStore("/seller"), searchParams]);
  const [s, account, openQuestions] = await Promise.all([getSellerStats(store.id), getMyPayoutAccount(store.id), countOpenQuestions(store.id)]);
  const payout = payoutState(account);
  const cards = [
    { icon: Package, label: "Produtos ativos", value: `${s.activeProducts} de ${s.totalProducts}`, href: "/seller/produtos" },
    { icon: Receipt, label: "Pedidos", value: String(s.orders), hint: `${s.pendingOrders} aguardando pagamento`, href: "/seller/pedidos" },
    { icon: Wallet, label: "Vendas registradas", value: formatBRL(s.gmvCents), hint: "Pedidos registrados (pagos ou não)", href: "/seller/pedidos" },
    { icon: AlertTriangle, label: "Estoque baixo (≤ 2)", value: String(s.lowStock), href: "/seller/produtos" },
    { icon: MessageCircleQuestion, label: "Perguntas sem resposta", value: String(openQuestions), hint: "Responder rápido melhora sua reputação", href: "/seller/perguntas" },
  ];
  return (
    <div className="space-y-6">
      {sp.bemvindo && <Notice tone="success">Sua loja está aberta! Agora cadastre o primeiro produto.</Notice>}
      {payout !== "active" && (
        <section
          aria-label="Ativar recebimentos"
          data-testid="ativar-recebimentos"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-brand bg-brand-soft/40 p-4"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold text-navy">
              <Wallet className="h-4 w-4 text-brand" aria-hidden="true" />
              {payout === "none" ? "Ative seus recebimentos para começar a vender" : `Recebimentos: ${payoutStateLabel[payout]}`}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              Conecte sua conta Stripe (leva poucos minutos). Sem ela, os compradores não conseguem pagar os seus produtos.
            </p>
          </div>
          <ButtonLink href="/seller/pagamentos">{payout === "none" ? "Conectar conta Stripe" : "Continuar cadastro"}</ButtonLink>
        </section>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-navy">{store.name}</h1>
          <Link href={`/loja/${store.slug}`} className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
            Ver minha loja <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        <ButtonLink href="/seller/produtos/novo">
          <Plus className="h-4 w-4" aria-hidden="true" /> Novo produto
        </ButtonLink>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <li key={c.label}>
            <Link href={c.href} className="block rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[var(--shadow-card)] hover:border-navy-2">
              <c.icon className="h-5 w-5 text-brand" aria-hidden="true" />
              <p className="mt-2 text-sm text-muted">{c.label}</p>
              <p className="font-display text-2xl font-bold text-navy">{c.value}</p>
              {c.hint && <p className="text-xs text-muted">{c.hint}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/seller">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
      <Dashboard searchParams={searchParams as Promise<{ bemvindo?: string }>} />
    </Suspense>
  );
}
