import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Notice } from "@/components/market";
import { saveShippingRate } from "@/lib/shipping/admin-actions";
import { formatWeight, shippingServiceLabel, shippingZoneLabel } from "@/lib/shipping/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Frete", robots: { index: false } };
type SP = { erro?: string; ok?: string };
const zones = ["local", "estadual", "regional", "nacional"] as const;

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

async function Rates({ searchParams }: { searchParams: Promise<SP> }) {
  await connection();
  const supabase = await createClient();
  const [{ data }, sp] = await Promise.all([
    supabase.from("shipping_rates").select("service, zone, max_grams, price_cents, days").order("max_grams"),
    searchParams,
  ]);
  const rates = data ?? [];
  const weights = [...new Set(rates.map((r) => r.max_grams))];
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Tabela de frete</h1>
      <p className="text-sm text-muted">
        Preço e prazo por zona (a partir do CEP de origem da loja) e faixa de peso. Valores de referência no formato
        PAC/SEDEX dos Correios: revise antes do lançamento. Quando houver contrato com os Correios, a cotação passa a
        vir da API oficial. Cada alteração fica registrada na auditoria.
      </p>
      {sp.erro && <Notice tone="error">{sp.erro}</Notice>}
      {sp.ok && <Notice tone="success">Faixa atualizada.</Notice>}
      {(["pac", "sedex"] as const).map((service) => (
        <section key={service} className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white">
          <h2 className="border-b border-line px-4 py-3 font-semibold text-navy">{shippingServiceLabel[service]}</h2>
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-surface text-left text-xs text-muted">
                <th className="p-2">Até</th>
                {zones.map((z) => (
                  <th key={z} className="p-2">
                    {shippingZoneLabel[z]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weights.map((w) => (
                <tr key={w} className="border-t border-line">
                  <td className="p-2 font-semibold text-navy">{formatWeight(w)}</td>
                  {zones.map((z) => {
                    const r = rates.find((x) => x.service === service && x.zone === z && x.max_grams === w);
                    if (!r) return <td key={z} className="p-2 text-muted">—</td>;
                    const label = `${shippingServiceLabel[service]} ${z} até ${formatWeight(w)}`;
                    return (
                      <td key={z} className="p-2">
                        <form action={saveShippingRate} className="flex items-center gap-1">
                          <input type="hidden" name="service" value={service} />
                          <input type="hidden" name="zone" value={z} />
                          <input type="hidden" name="maxGrams" value={w} />
                          <input name="price" defaultValue={centsToInput(r.price_cents)} aria-label={`Preço ${label}`} inputMode="decimal" className="h-8 w-20 rounded-lg border border-line px-2" />
                          <input name="days" defaultValue={r.days} aria-label={`Prazo em dias ${label}`} inputMode="numeric" className="h-8 w-10 rounded-lg border border-line px-2" />
                          <button type="submit" className="h-8 rounded-lg border border-line px-2 text-xs font-semibold text-navy hover:bg-surface">
                            Salvar
                          </button>
                        </form>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/admin/frete">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
      <Rates searchParams={searchParams as Promise<SP>} />
    </Suspense>
  );
}
