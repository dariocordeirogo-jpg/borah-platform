import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatBRL } from "@/lib/format";
import { getOverview } from "@/lib/admin/queries";
import { orderStatusLabel } from "@/lib/market/format";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

async function Overview() {
  const o = await getOverview();
  if (!o) return null;
  const cards: { label: string; value: string; href?: string; alert?: boolean }[] = [
    { label: "Denúncias abertas", value: String(o.reports_open), href: "/admin/denuncias", alert: o.reports_open > 0 },
    { label: "Vendas pagas (GMV)", value: formatBRL(o.gmv_cents) },
    { label: "Comissão da plataforma", value: formatBRL(o.fees_cents) },
    { label: "Comissões de afiliados confirmadas", value: formatBRL(o.affiliate_confirmed_cents) },
    { label: "Reembolsado", value: formatBRL(o.refunded_cents) },
    { label: "Pagamentos a devolver", value: String(o.needs_refund), href: "/admin/pedidos", alert: o.needs_refund > 0 },
    { label: "Usuários", value: String(o.users) },
    { label: "Lojas ativas / suspensas", value: `${o.stores_active} / ${o.stores_suspended}`, href: "/admin/lojas" },
    { label: "Produtos à venda / bloqueados", value: `${o.products_active} / ${o.products_blocked}`, href: "/admin/moderacao" },
    { label: "Leilões em andamento", value: String(o.auctions_active) },
    { label: "Lives no ar", value: String(o.lives_now), href: "/admin/moderacao" },
    { label: "Vídeos publicados", value: String(o.videos_published), href: "/admin/moderacao" },
  ];
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Visão geral</h1>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => {
          const body = (
            <>
              <dt className="text-xs text-muted">{c.label}</dt>
              <dd className={c.alert ? "mt-1 font-display text-xl font-bold text-brand" : "mt-1 font-display text-xl font-bold text-navy"}>{c.value}</dd>
            </>
          );
          return c.href ? (
            <Link key={c.label} href={c.href} className="rounded-[var(--radius-card)] border border-line bg-white p-4 hover:border-navy-2" data-testid={`card-${c.label}`}>
              {body}
            </Link>
          ) : (
            <div key={c.label} className="rounded-[var(--radius-card)] border border-line bg-white p-4" data-testid={`card-${c.label}`}>
              {body}
            </div>
          );
        })}
      </dl>
      <section className="rounded-[var(--radius-card)] border border-line bg-white p-4">
        <h2 className="text-sm font-semibold text-navy">Pedidos por situação</h2>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {Object.entries(orderStatusLabel).map(([k, label]) => (
            <li key={k} className="rounded-full bg-navy-soft px-3 py-1 text-navy">
              {label}: <strong>{o.orders[k] ?? 0}</strong>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
      <Overview />
    </Suspense>
  );
}
