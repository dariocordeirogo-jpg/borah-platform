import type { Metadata } from "next";
import { Suspense } from "react";
import { CouponForm } from "@/components/coupons/coupon-form";
import { EmptyState, Notice } from "@/components/market";
import { Button } from "@/components/ui/button";
import { toggleCoupon } from "@/lib/coupons/actions";
import { describeCoupon } from "@/lib/coupons/format";
import { getStoreCoupons } from "@/lib/coupons/queries";
import { requireStore } from "@/lib/market/seller-guard";

export const metadata: Metadata = { title: "Cupons" };
type SP = { erro?: string; ok?: string };

function validity(endsAt: string | null): string {
  if (!endsAt) return "Sem prazo";
  const d = new Date(endsAt);
  const when = d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  return d.getTime() <= Date.now() ? `Venceu em ${when}` : `Até ${when}`;
}

async function Coupons({ searchParams }: { searchParams: Promise<SP> }) {
  const [store, sp] = await Promise.all([requireStore("/seller/cupons"), searchParams]);
  const coupons = await getStoreCoupons(store.id);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Cupons</h1>
      {sp.ok && <Notice tone="success">Cupom criado. Divulgue o código para seus clientes.</Notice>}
      {sp.erro && <Notice tone="error">{sp.erro}</Notice>}
      <CouponForm />
      {!coupons.length ? (
        <EmptyState title="Nenhum cupom ainda">Crie um cupom para atrair clientes nas suas lives e vídeos.</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white" aria-label="Seus cupons">
          {coupons.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm" data-testid="cupom">
              <div>
                <p className="font-mono text-base font-bold text-navy">{c.code}</p>
                <p className="text-muted">{describeCoupon(c)}</p>
                <p className="text-xs text-muted">
                  {c.uses_count} uso{c.uses_count === 1 ? "" : "s"}
                  {c.max_uses ? ` de ${c.max_uses}` : ""} · {validity(c.ends_at)}
                </p>
              </div>
              <form action={toggleCoupon} className="flex items-center gap-3">
                <span className={c.is_active ? "font-semibold text-navy" : "text-muted"}>{c.is_active ? "Ativo" : "Desativado"}</span>
                <input type="hidden" name="couponId" value={c.id} />
                <input type="hidden" name="active" value={c.is_active ? "0" : "1"} />
                <Button type="submit" size="sm" variant="outline" aria-label={`${c.is_active ? "Desativar" : "Ativar"} cupom ${c.code}`}>
                  {c.is_active ? "Desativar" : "Ativar"}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/seller/cupons">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
      <Coupons searchParams={searchParams as Promise<SP>} />
    </Suspense>
  );
}
