import type { Metadata } from "next";
import { Suspense } from "react";
import { Zap } from "lucide-react";
import { EmptyState, Notice } from "@/components/market";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { getSellerProducts } from "@/lib/market/queries";
import { requireStore } from "@/lib/market/seller-guard";
import { cancelFlashDeal, createFlashDeal } from "@/lib/offers/actions";
import { getStoreFlashDeals } from "@/lib/offers/queries";

export const metadata: Metadata = { title: "Ofertas relâmpago" };
type SP = { erro?: string; ok?: string; encerrada?: string };

const statusLabel = { scheduled: "Agendada", active: "No ar", ended: "Terminada", cancelled: "Encerrada pela loja" } as const;
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const input = "h-11 w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-navy-2 focus:ring-2 focus:ring-navy-2/20";

async function Deals({ searchParams }: { searchParams: Promise<SP> }) {
  const [store, sp] = await Promise.all([requireStore("/seller/ofertas"), searchParams]);
  const [products, deals] = await Promise.all([getSellerProducts(store.id), getStoreFlashDeals(store.id)]);
  const active = products.filter((p) => p.status === "active");
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-navy">
        <Zap className="h-6 w-6 text-brand" aria-hidden="true" /> Ofertas relâmpago
      </h1>
      <p className="text-sm text-muted">
        Dê um desconto por tempo limitado (1 a 24 horas). No horário marcado o preço do anúncio muda sozinho, o preço antigo aparece
        riscado e o produto entra na página de Ofertas. No fim, o preço normal volta.
      </p>
      {sp.ok && <Notice tone="success">Oferta relâmpago salva.</Notice>}
      {sp.encerrada && <Notice tone="success">Oferta encerrada. O preço normal voltou.</Notice>}
      {sp.erro && <Notice tone="error">{sp.erro}</Notice>}

      {active.length ? (
        <form action={createFlashDeal} className="grid gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 sm:grid-cols-2" aria-label="Nova oferta relâmpago">
          <label className="text-sm font-medium text-navy sm:col-span-2">
            Produto
            <select name="productId" required className={`${input} mt-1`}>
              {active.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} — {formatBRL(p.price_cents)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-navy">
            Preço da oferta (R$)
            <input name="price" required inputMode="decimal" placeholder="79,90" className={`${input} mt-1`} />
          </label>
          <label className="text-sm font-medium text-navy">
            Duração
            <select name="hours" defaultValue="6" className={`${input} mt-1`}>
              {[1, 2, 3, 4, 6, 8, 12, 24].map((h) => (
                <option key={h} value={h}>
                  {h} {h === 1 ? "hora" : "horas"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-navy sm:col-span-2">
            Começar em <span className="font-normal text-muted">(horário de Brasília; vazio = agora)</span>
            <input name="startsAt" type="datetime-local" className={`${input} mt-1`} />
          </label>
          <p className="text-xs text-muted sm:col-span-2">O desconto precisa ser de pelo menos 5%. Um produto só pode ter uma oferta por vez.</p>
          <div className="sm:col-span-2">
            <Button type="submit">Salvar oferta relâmpago</Button>
          </div>
        </form>
      ) : (
        <EmptyState title="Nenhum produto à venda">Ative um anúncio para colocá-lo em oferta relâmpago.</EmptyState>
      )}

      {deals.length > 0 && (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white" aria-label="Suas ofertas relâmpago">
          {deals.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm" data-testid="oferta-relampago">
              <div>
                <p className="font-semibold text-navy">{d.products?.title}</p>
                <p className="text-muted">
                  {formatBRL(d.deal_price_cents)}
                  {d.original_price_cents ? <> · antes {formatBRL(d.original_price_cents)}</> : null} · {when(d.starts_at)} até {when(d.ends_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={d.status === "active" ? "font-semibold text-brand" : "text-muted"}>{statusLabel[d.status]}</span>
                {(d.status === "active" || d.status === "scheduled") && (
                  <form action={cancelFlashDeal}>
                    <input type="hidden" name="dealId" value={d.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Encerrar
                    </Button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/seller/ofertas">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
      <Deals searchParams={searchParams as Promise<SP>} />
    </Suspense>
  );
}
