import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Info } from "lucide-react";
import { ConfirmWinForm } from "@/components/auctions/confirm-win-form";
import { AddressForm } from "@/components/checkout-forms";
import { getAuction } from "@/lib/auctions/queries";
import { getCurrentUser } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { getMyAddresses } from "@/lib/market/queries";

export const metadata: Metadata = { title: "Confirmar arremate", robots: { index: false } };

async function Confirm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getCurrentUser())) redirect(`/entrar?next=/leilao/${id}/arremate`);
  const d = await getAuction(id);
  if (!d || !d.me?.is_winner) notFound();
  if (d.auction.order_id) redirect(`/conta/pedidos/${d.auction.order_id}`);
  if (d.auction.outcome !== "sold") redirect(`/leilao/${id}`);
  const addresses = await getMyAddresses();
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <AddressForm open={!addresses.length} next={`/leilao/${id}/arremate`} />
        <p className="flex items-start gap-2 rounded-xl bg-navy-soft px-4 py-3 text-sm text-navy">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Ao confirmar, o pedido do arremate é registrado como “Aguardando pagamento”. Em seguida você paga pelo LIVELANCE PAY na página do pedido.
        </p>
      </div>
      <aside className="h-fit rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
        <p className="text-sm text-muted">Arremate</p>
        <p className="font-semibold text-navy">{d.auction.title}</p>
        <p className="mt-2 text-3xl font-extrabold text-navy">{formatBRL(d.auction.winning_bid_cents ?? 0)}</p>
        <p className="mb-4 text-xs text-muted">
          Prazo: {d.auction.payment_due_at && new Date(d.auction.payment_due_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        </p>
        <ConfirmWinForm auctionId={id} addresses={addresses} />
      </aside>
    </div>
  );
}

export default function Page({ params }: PageProps<"/leilao/[id]/arremate">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 font-display text-2xl font-bold tracking-tight text-navy">Confirmar arremate</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Confirm params={params} />
      </Suspense>
    </div>
  );
}
