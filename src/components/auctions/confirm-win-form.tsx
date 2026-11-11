"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmWin } from "@/lib/auctions/actions";

type Addr = { id: string; recipient: string; street: string; number: string; complement: string | null; district: string; city: string; state: string; cep: string; is_default: boolean };

export function ConfirmWinForm({ auctionId, addresses }: { auctionId: string; addresses: Addr[] }) {
  const [state, action, pending] = useActionState(confirmWin, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="auctionId" value={auctionId} />
      {addresses.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold text-navy">Entregar em</legend>
          {addresses.map((a, i) => (
            <label key={a.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft/40">
              <input type="radio" name="addressId" value={a.id} defaultChecked={a.is_default || i === 0} className="mt-1 accent-[#D71920]" />
              <span className="text-sm">
                <span className="block font-semibold text-navy">{a.recipient}</span>
                <span className="block text-muted">
                  {a.street}, {a.number}
                  {a.complement ? ` – ${a.complement}` : ""} · {a.district} · {a.city}/{a.state}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="buy" size="lg" className="w-full" disabled={pending || !addresses.length}>
        {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />} Confirmar arremate
      </Button>
    </form>
  );
}
