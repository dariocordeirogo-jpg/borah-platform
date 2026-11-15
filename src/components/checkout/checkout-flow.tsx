"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Banknote, Check, CreditCard, Loader2, Lock, MapPin, PackageCheck, QrCode, ShieldCheck, Store, Tag, Truck } from "lucide-react";
import { AddressForm } from "@/components/checkout-forms";
import { Button } from "@/components/ui/button";
import { previewCoupon } from "@/lib/coupons/actions";
import { formatBRL } from "@/lib/format";
import { placeOrder } from "@/lib/market/actions";
import { quoteShipping } from "@/lib/shipping/actions";
import { arrivalLabel, formatWeight, shippingServiceLabel, shippingTotal, type ShippingQuote, type ShippingService } from "@/lib/shipping/format";
import { cn } from "@/lib/utils";

export type CheckoutAddress = {
  id: string;
  recipient: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  cep: string;
  is_default: boolean;
};
export type CheckoutGroup = {
  store: { id: string; name: string; slug: string };
  items: { productId: string; title: string; imageUrl: string | null; quantity: number; priceCents: number; lineTotalCents: number }[];
};

const FORM = "checkout";
const input =
  "h-11 w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-navy-2 focus:ring-2 focus:ring-navy-2/20";
const cep = (v: string) => v.replace(/(\d{5})(\d{3})/, "$1-$2");

function Steps() {
  const steps = ["Carrinho", "Entrega", "Pagamento", "Confirmação"];
  return (
    <ol className="flex items-center gap-2 text-xs font-semibold" aria-label="Etapas da compra">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
              i === 0 ? "bg-success text-white" : i === 1 ? "bg-brand text-white" : "bg-surface-2 text-muted",
            )}
            aria-hidden="true"
          >
            {i === 0 ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className={cn(i === 1 ? "text-navy" : "text-muted", i > 1 && "hidden sm:inline")} aria-current={i === 1 ? "step" : undefined}>
            {s}
          </span>
          {i < steps.length - 1 && <span className="h-px w-4 bg-line sm:w-8" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

function Section({ n, title, icon: Icon, children, aside }: { n: number; title: string; icon: typeof Truck; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[var(--shadow-card)] md:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-navy md:text-lg">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-xs text-white" aria-hidden="true">
            {n}
          </span>
          <Icon className="h-4 w-4 text-brand" aria-hidden="true" />
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function AddressBlock({ addresses, value, onChange }: { addresses: CheckoutAddress[]; value: string | null; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = addresses.find((a) => a.id === value) ?? null;
  if (!addresses.length) return <AddressForm open />;
  return (
    <div className="space-y-3">
      {!open && selected && (
        <div className="flex items-start gap-3 rounded-xl border border-brand bg-brand-soft/30 p-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Entregar em</p>
            <p className="font-semibold text-navy">
              {selected.street}, {selected.number}
              {selected.complement ? ` – ${selected.complement}` : ""}
            </p>
            <p className="text-muted">
              {selected.district} · {selected.city}/{selected.state} · CEP {cep(selected.cep)}
            </p>
            <p className="text-muted">Quem recebe: {selected.recipient}</p>
          </div>
          {addresses.length > 1 && (
            <button type="button" onClick={() => setOpen(true)} className="shrink-0 text-sm font-semibold text-brand hover:underline">
              Alterar
            </button>
          )}
        </div>
      )}
      <fieldset className={cn("space-y-2", !open && "hidden")}>
        <legend className="sr-only">Escolha o endereço</legend>
        {addresses.map((a) => (
          <label
            key={a.id}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft/30"
          >
            <input
              type="radio"
              form={FORM}
              name="addressId"
              value={a.id}
              checked={value === a.id}
              onChange={() => {
                onChange(a.id);
                setOpen(false);
              }}
              className="mt-1 accent-brand"
            />
            <span>
              <span className="block font-semibold text-navy">
                {a.street}, {a.number}
                {a.complement ? ` – ${a.complement}` : ""}
              </span>
              <span className="block text-muted">
                {a.district} · {a.city}/{a.state} · CEP {cep(a.cep)} · {a.recipient}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <AddressForm open={false} />
    </div>
  );
}

export function CheckoutFlow({
  addresses,
  groups,
  productsCents,
  count,
  testMode,
}: {
  addresses: CheckoutAddress[];
  groups: CheckoutGroup[];
  productsCents: number;
  count: number;
  testMode: boolean;
}) {
  const [state, action, pending] = useActionState(placeOrder, {});
  const [addressId, setAddressId] = useState<string | null>(addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? null);
  const [service, setService] = useState<ShippingService>("pac");
  const [quote, setQuote] = useState<{ quotes?: ShippingQuote[]; error?: string; for?: string }>({});
  const [loading, startLoading] = useTransition();
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<{ ok?: string; error?: string; discountCents?: number; code?: string }>({});
  const [checking, startCheck] = useTransition();

  useEffect(() => {
    if (!addressId) return;
    startLoading(async () => setQuote({ ...(await quoteShipping(addressId)), for: addressId }));
  }, [addressId]);

  const quotes = quote.for === addressId ? (quote.quotes ?? []) : [];
  const priced = quotes.filter((q) => q.pac || q.sedex);
  const shipping = shippingTotal(priced, service);
  const discount = coupon.ok && coupon.code === code ? (coupon.discountCents ?? 0) : 0;
  const total = Math.max(0, productsCents + shipping - discount);
  const quoteFor = (storeId: string) => quotes.find((q) => q.store_id === storeId);
  const maxDays = (s: ShippingService) => Math.max(0, ...priced.map((q) => q[s]?.days ?? 0));

  return (
    <div className="space-y-5">
      <Steps />
      <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Section n={1} title="Endereço de entrega" icon={MapPin}>
            <AddressBlock addresses={addresses} value={addressId} onChange={setAddressId} />
          </Section>

          <Section
            n={2}
            title="Envios"
            icon={Truck}
            aside={<span className="text-xs text-muted">{groups.length === 1 ? "1 envio" : `${groups.length} envios`} · Correios</span>}
          >
            <div className="space-y-3" data-testid="frete">
              {!addressId ? (
                <p className="text-sm text-muted">Cadastre um endereço para ver as opções de entrega.</p>
              ) : loading ? (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Calculando o frete…
                </p>
              ) : quote.error ? (
                <p role="alert" className="text-sm text-danger">
                  {quote.error}
                </p>
              ) : (
                priced.length > 0 && (
                  <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <legend className="sr-only">Forma de envio</legend>
                    {(["pac", "sedex"] as const).map((s) => (
                      <label
                        key={s}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-white p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft/30"
                      >
                        <span className="flex items-center gap-2.5">
                          <input type="radio" form={FORM} name="shippingService" value={s} checked={service === s} onChange={() => setService(s)} className="accent-brand" />
                          <span>
                            <span className="block font-semibold text-navy">{shippingServiceLabel[s]}</span>
                            <span className="block text-xs text-success">{arrivalLabel(maxDays(s))}</span>
                          </span>
                        </span>
                        <span className="font-semibold text-navy">{formatBRL(shippingTotal(priced, s))}</span>
                      </label>
                    ))}
                  </fieldset>
                )
              )}

              <ul className="space-y-3">
                {groups.map((g, i) => {
                  const q = quoteFor(g.store.id);
                  const line = q?.[service];
                  return (
                    <li key={g.store.id} className="rounded-xl border border-line" data-testid={`envio-${i + 1}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2 text-xs">
                        <span className="font-semibold text-navy">
                          Envio {i + 1}
                          {groups.length > 1 ? ` de ${groups.length}` : ""}
                        </span>
                        <Link href={`/loja/${g.store.slug}`} className="flex items-center gap-1 text-muted hover:text-navy">
                          <Store className="h-3.5 w-3.5" aria-hidden="true" /> Vendido por <span className="font-semibold text-navy">{g.store.name}</span>
                        </Link>
                      </div>
                      <ul className="divide-y divide-line">
                        {g.items.map((it) => (
                          <li key={it.productId} className="flex items-center gap-3 p-3">
                            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
                              {it.imageUrl ? (
                                <Image src={it.imageUrl} alt="" fill sizes="56px" className="object-contain" />
                              ) : (
                                <PackageCheck className="m-4 h-6 w-6 text-muted" aria-hidden="true" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-2 text-sm text-ink">{it.title}</span>
                              <span className="text-xs text-muted">
                                {it.quantity} {it.quantity === 1 ? "unidade" : "unidades"} · {formatBRL(it.priceCents)} cada
                              </span>
                            </span>
                            <span className="shrink-0 text-sm font-semibold text-navy">{formatBRL(it.lineTotalCents)}</span>
                          </li>
                        ))}
                      </ul>
                      {addressId && !loading && q && (
                        <p className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-3 py-2 text-xs">
                          {line ? (
                            <>
                              <span className="font-semibold text-success">{arrivalLabel(line.days)}</span>
                              <span className="text-muted">
                                {shippingServiceLabel[service]} · {formatWeight(q.grams)} · <span className="font-semibold text-navy">{formatBRL(line.price_cents)}</span>
                              </span>
                            </>
                          ) : (
                            <span className="text-muted">Frete a combinar com a loja (ela ainda não informou o CEP de origem).</span>
                          )}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </Section>

          <Section n={3} title="Cupom" icon={Tag}>
            <div className="space-y-2">
              <label htmlFor="coupon" className="text-sm text-muted">
                Cupom de desconto <span className="text-xs">(opcional)</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="coupon"
                  form={FORM}
                  name="coupon"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setCoupon({});
                  }}
                  maxLength={20}
                  autoComplete="off"
                  placeholder="EX.: BEMVINDO10"
                  className={input}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!code.trim() || checking}
                  onClick={() => startCheck(async () => setCoupon({ ...(await previewCoupon(code)), code }))}
                >
                  {checking && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Aplicar
                </Button>
              </div>
              {coupon.ok && (
                <p className="text-sm text-success" data-testid="cupom-ok" role="status">
                  {coupon.ok}
                </p>
              )}
              {coupon.error && (
                <p className="text-sm text-danger" role="alert">
                  {coupon.error}
                </p>
              )}
            </div>
          </Section>

          <Section n={4} title="Pagamento" icon={CreditCard}>
            <p className="text-sm text-muted">
              Um pagamento só para todos os envios. Na próxima tela você paga aqui mesmo na Zexi, com cartão, Pix ou boleto.
            </p>
            <ul className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-navy">
              {[
                { icon: CreditCard, label: "Cartão" },
                { icon: QrCode, label: "Pix" },
                { icon: Banknote, label: "Boleto" },
              ].map((m) => (
                <li key={m.label} className="rounded-xl border border-line px-2 py-3">
                  <m.icon className="mx-auto mb-1 h-5 w-5 text-brand" aria-hidden="true" />
                  {m.label}
                </li>
              ))}
            </ul>
            {testMode && (
              <p className="mt-3 rounded-lg bg-navy-soft px-3 py-2 text-xs text-navy" data-testid="pay-teste">
                Pagamentos em fase de testes: nenhuma cobrança real é feita.
              </p>
            )}
          </Section>
        </div>

        <aside className="h-fit space-y-3 lg:sticky lg:top-24">
          <section className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]" aria-label="Resumo da compra">
            <h2 className="font-display text-lg font-bold text-navy">Resumo da compra</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Produtos ({count})</dt>
                <dd>{formatBRL(productsCents)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Frete</dt>
                <dd data-testid="frete-total" className={cn(!priced.length && "text-muted")}>
                  {!addressId || loading ? "—" : priced.length ? (shipping ? formatBRL(shipping) : "Grátis") : "A combinar"}
                </dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between gap-3 text-success">
                  <dt>Cupom {coupon.code}</dt>
                  <dd>− {formatBRL(discount)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <dt className="font-semibold text-navy">Você pagará</dt>
                <dd className="font-display text-2xl font-bold text-navy" data-testid="total-com-frete">
                  {formatBRL(total)}
                </dd>
              </div>
            </dl>

            <form id={FORM} action={action} className="mt-4 space-y-3">
              {state.error && (
                <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
                  {state.error}
                </p>
              )}
              <Button type="submit" variant="buy" size="lg" className="w-full" disabled={pending || !addressId}>
                {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                Finalizar compra
              </Button>
              {!addressId && <p className="text-center text-xs text-muted">Cadastre um endereço para continuar.</p>}
            </form>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Pagamento seguro pela Stripe
            </p>
          </section>

          <div className="flex gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 text-sm">
            <ShieldCheck className="h-6 w-6 shrink-0 text-success" aria-hidden="true" />
            <p>
              <span className="font-semibold text-navy">Compra Garantida Zexi.</span>{" "}
              <span className="text-muted">O valor fica retido e a loja só recebe depois que você confirmar a entrega.</span>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
