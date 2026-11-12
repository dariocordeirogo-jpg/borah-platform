"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitVerification } from "@/lib/auctions/actions";

const input =
  "h-12 w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-navy-2 focus:ring-2 focus:ring-navy-2/20 aria-[invalid=true]:border-danger";

export function VerificationForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(submitVerification, {});
  const err = (n: string) => state.fieldErrors?.[n]?.[0];
  return (
    <form action={action} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p>}
      {state.message && <p role="status" className="rounded-xl bg-success-soft px-3 py-2 text-sm text-success">{state.message}</p>}
      <div>
        <label htmlFor="cpf" className="mb-1 block text-sm font-medium text-navy">CPF</label>
        <input id="cpf" name="cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" aria-invalid={err("cpf") ? true : undefined} aria-describedby="cpf-erro" className={input} />
        {err("cpf") && <p id="cpf-erro" className="mt-1 text-sm text-danger">{err("cpf")}</p>}
      </div>
      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium text-navy">Celular com DDD</label>
        <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(11) 98888-7777" aria-invalid={err("phone") ? true : undefined} aria-describedby="phone-erro" className={input} />
        {err("phone") && <p id="phone-erro" className="mt-1 text-sm text-danger">{err("phone")}</p>}
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" className="mt-0.5 h-5 w-5 accent-brand" />
        <span>
          Li e concordo com as{" "}
          <Link href="/leiloes/regras" className="font-semibold text-brand underline">regras dos leilões</Link>: lance é compromisso de compra.
        </span>
      </label>
      {err("consent") && <p className="-mt-2 text-sm text-danger">{err("consent")}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />} Confirmar dados
      </Button>
    </form>
  );
}
