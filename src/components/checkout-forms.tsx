"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { previewCoupon } from "@/lib/coupons/actions";
import { formatBRL } from "@/lib/format";
import { placeOrder, saveAddress, type FormState } from "@/lib/market/actions";
import { quoteShipping } from "@/lib/shipping/actions";
import { formatDays, formatWeight, shippingServiceLabel, shippingTotal, type ShippingQuote, type ShippingService } from "@/lib/shipping/format";
import { UFS } from "@/lib/market/schemas";

const input =
  "h-11 w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-navy-2 focus:ring-2 focus:ring-navy-2/20 aria-[invalid=true]:border-danger";

function Field({
  name,
  label,
  state,
  className,
  ...rest
}: { name: string; label: string; state: FormState; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const err = state.fieldErrors?.[name]?.[0];
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-navy">
        {label}
      </label>
      <input id={name} name={name} aria-invalid={err ? true : undefined} aria-describedby={err ? `${name}-erro` : undefined} className={input} {...rest} />
      {err && (
        <p id={`${name}-erro`} className="mt-1 text-sm text-danger">
          {err}
        </p>
      )}
    </div>
  );
}

export function AddressForm({ open, next }: { open: boolean; next?: string }) {
  const [state, action, pending] = useActionState(saveAddress, {});
  return (
    <details open={open} className="rounded-[var(--radius-card)] border border-line bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-navy">+ Novo endereço</summary>
      <form action={action} className="mt-4 grid grid-cols-6 gap-3" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        {state.error && <p className="col-span-6 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p>}
        {state.message && <p role="status" className="col-span-6 rounded-xl bg-success-soft px-3 py-2 text-sm text-success">{state.message}</p>}
        <Field name="recipient" label="Quem vai receber" state={state} autoComplete="name" className="col-span-6" />
        <Field name="cep" label="CEP" state={state} inputMode="numeric" autoComplete="postal-code" className="col-span-3 sm:col-span-2" />
        <Field name="street" label="Rua" state={state} autoComplete="address-line1" className="col-span-6 sm:col-span-4" />
        <Field name="number" label="Número" state={state} className="col-span-2" />
        <Field name="complement" label="Complemento" state={state} autoComplete="address-line2" className="col-span-4" />
        <Field name="district" label="Bairro" state={state} className="col-span-6 sm:col-span-2" />
        <Field name="city" label="Cidade" state={state} autoComplete="address-level2" className="col-span-4 sm:col-span-3" />
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="state" className="mb-1 block text-sm font-medium text-navy">
            UF
          </label>
          <select id="state" name="state" defaultValue="" className={input}>
            <option value="" disabled>
              —
            </option>
            {UFS.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </select>
          {state.fieldErrors?.state && <p className="mt-1 text-sm text-danger">{state.fieldErrors.state[0]}</p>}
        </div>
        <div className="col-span-6">
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Salvar endereço
          </Button>
        </div>
      </form>
    </details>
  );
}

function CouponField() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});
  const [checking, startCheck] = useTransition();
  return (
    <div className="space-y-2">
      <label htmlFor="coupon" className="text-sm font-semibold text-navy">
        Cupom de desconto <span className="font-normal text-muted">(opcional)</span>
      </label>
      <div className="flex gap-2">
        <input
          id="coupon"
          name="coupon"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setResult({});
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
          onClick={() => startCheck(async () => setResult(await previewCoupon(code)))}
        >
          {checking && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Aplicar
        </Button>
      </div>
      {result.ok && (
        <p className="text-sm text-navy" data-testid="cupom-ok" role="status">
          {result.ok}
        </p>
      )}
      {result.error && (
        <p className="text-sm text-danger" role="alert">
          {result.error}
        </p>
      )}
    </div>
  );
}

function ShippingOptions({ addressId, productsCents }: { addressId: string | null; productsCents: number }) {
  const [service, setService] = useState<ShippingService>("pac");
  const [result, setResult] = useState<{ quotes?: ShippingQuote[]; error?: string; for?: string }>({});
  const [loading, startLoading] = useTransition();
  useEffect(() => {
    if (!addressId) return;
    startLoading(async () => setResult({ ...(await quoteShipping(addressId)), for: addressId }));
  }, [addressId]);

  const quotes = result.for === addressId ? (result.quotes ?? []) : [];
  const priced = quotes.filter((q) => q.pac || q.sedex);
  const toArrange = quotes.filter((q) => !q.pac && !q.sedex);
  const shipping = shippingTotal(quotes, service);
  const option = (s: ShippingService) => {
    const days = Math.max(0, ...priced.map((q) => q[s]?.days ?? 0));
    return (
      <label
        key={s}
        className="flex flex-1 cursor-pointer items-center justify-between gap-2 rounded-xl border border-line bg-white p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft/40"
      >
        <span className="flex items-center gap-2">
          <input type="radio" name="shippingService" value={s} checked={service === s} onChange={() => setService(s)} className="accent-brand" />
          <span>
            <span className="block font-semibold text-navy">{shippingServiceLabel[s]}</span>
            <span className="block text-xs text-muted">até {formatDays(days)}</span>
          </span>
        </span>
        <span className="font-semibold text-navy">{formatBRL(shippingTotal(priced, s))}</span>
      </label>
    );
  };

  return (
    <fieldset className="space-y-2" data-testid="frete">
      <legend className="mb-2 text-sm font-semibold text-navy">Frete (Correios)</legend>
      {loading && <p className="text-sm text-muted">Calculando o frete…</p>}
      {result.error && (
        <p role="alert" className="text-sm text-danger">
          {result.error}
        </p>
      )}
      {!loading && priced.length > 0 && <div className="flex gap-2">{(["pac", "sedex"] as const).map(option)}</div>}
      {!loading && priced.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted">
          {priced.map((q) => (
            <li key={q.store_id}>
              {q.store_name}: {formatWeight(q.grams)} · {shippingServiceLabel[service]} {formatBRL(q[service]?.price_cents ?? 0)} ·{" "}
              {formatDays(q[service]?.days ?? 0)}
            </li>
          ))}
        </ul>
      )}
      {!loading && toArrange.length > 0 && (
        <p className="text-xs text-muted">
          Frete a combinar com {toArrange.map((q) => q.store_name).join(", ")} (a loja ainda não informou o CEP de origem).
        </p>
      )}
      {!loading && quotes.length > 0 && (
        <dl className="space-y-1 border-t border-line pt-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Produtos</dt>
            <dd>{formatBRL(productsCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Frete</dt>
            <dd data-testid="frete-total">{priced.length ? formatBRL(shipping) : "A combinar"}</dd>
          </div>
          <div className="flex justify-between font-bold text-navy">
            <dt>Total</dt>
            <dd data-testid="total-com-frete">{formatBRL(productsCents + shipping)}</dd>
          </div>
        </dl>
      )}
    </fieldset>
  );
}

export function PlaceOrderForm({
  addresses,
  productsCents,
}: {
  productsCents: number;
  addresses: { id: string; recipient: string; street: string; number: string; complement: string | null; district: string; city: string; state: string; cep: string; is_default: boolean }[];
}) {
  const [state, action, pending] = useActionState(placeOrder, {});
  const initial = addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? null;
  const [addressId, setAddressId] = useState<string | null>(initial);
  return (
    <form action={action} className="space-y-4">
      {addresses.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold text-navy">Entregar em</legend>
          {addresses.map((a) => (
            <label
              key={a.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft/40"
            >
              <input
                type="radio"
                name="addressId"
                value={a.id}
                checked={addressId === a.id}
                onChange={() => setAddressId(a.id)}
                className="mt-1 accent-brand"
              />
              <span className="text-sm">
                <span className="block font-semibold text-navy">{a.recipient}</span>
                <span className="block text-muted">
                  {a.street}, {a.number}
                  {a.complement ? ` – ${a.complement}` : ""} · {a.district}
                </span>
                <span className="block text-muted">
                  {a.city}/{a.state} · CEP {a.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {addresses.length > 0 && <ShippingOptions addressId={addressId} productsCents={productsCents} />}
      {addresses.length > 0 && <CouponField />}
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="buy" size="lg" className="w-full" disabled={pending || !addresses.length}>
        {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        Finalizar compra
      </Button>
      {!addresses.length && <p className="text-center text-xs text-muted">Cadastre um endereço para continuar.</p>}
    </form>
  );
}
