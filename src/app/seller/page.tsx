import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, ExternalLink, Package, Plus, Receipt, Wallet } from "lucide-react";
import { Notice } from "@/components/market";
import { ButtonLink } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { getSellerStats } from "@/lib/market/queries";
import { requireStore } from "@/lib/market/seller-guard";

async function Dashboard({ searchParams }: { searchParams: Promise<{ bemvindo?: string }> }) {
  const [store, sp] = await Promise.all([requireStore("/seller"), searchParams]);
  const s = await getSellerStats(store.id);
  const cards = [
    { icon: Package, label: "Produtos ativos", value: `${s.activeProducts} de ${s.totalProducts}`, href: "/seller/produtos" },
    { icon: Receipt, label: "Pedidos", value: String(s.orders), hint: `${s.pendingOrders} aguardando pagamento`, href: "/seller/pedidos" },
    { icon: Wallet, label: "Vendas registradas", value: formatBRL(s.gmvCents), hint: "Sem pagamento real até a Fase 4", href: "/seller/pedidos" },
    { icon: AlertTriangle, label: "Estoque baixo (≤ 2)", value: String(s.lowStock), href: "/seller/produtos" },
  ];
  return (
    <div className="space-y-6">
      {sp.bemvindo && <Notice tone="success">Sua loja está aberta! Agora cadastre o primeiro produto.</Notice>}
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
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
