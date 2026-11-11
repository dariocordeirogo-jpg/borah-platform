"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { previewCoupon } from "@/lib/coupons/actions";
import { placeOrder, saveAddress, type FormState } from "@/lib/market/actions";
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

export function PlaceOrderForm({
  addresses,
}: {
  addresses: { id: string; recipient: string; street: string; number: string; complement: string | null; district: string; city: string; state: string; cep: string; is_default: boolean }[];
}) {
  const [state, action, pending] = useActionState(placeOrder, {});
  return (
    <form action={action} className="space-y-4">
      {addresses.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold text-navy">Entregar em</legend>
          {addresses.map((a, i) => (
            <label
              key={a.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft/40"
            >
              <input type="radio" name="addressId" value={a.id} defaultChecked={a.is_default || i === 0} className="mt-1 accent-[#D71920]" />
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
