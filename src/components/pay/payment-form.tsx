"use client";

import { useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { CheckoutElementsProvider, PaymentElement, useCheckoutElements } from "@stripe/react-stripe-js/checkout";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";

// Um carregamento do Stripe.js por chave (fora da renderização, como recomenda a Stripe)
const stripeCache = new Map<string, Promise<Stripe | null>>();
function stripeFor(publishableKey: string) {
  let p = stripeCache.get(publishableKey);
  if (!p) {
    p = loadStripe(publishableKey, { locale: "pt-BR" });
    stripeCache.set(publishableKey, p);
  }
  return p;
}

// Formulário de pagamento com as cores e a fonte da Zexi
const appearance = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#FF4D2D",
    colorText: "#0F1115",
    colorDanger: "#DC2626",
    borderRadius: "12px",
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

function Form({ amountCents }: { amountCents: number }) {
  const state = useCheckoutElements();
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  if (state.type === "loading") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando formas de pagamento…
      </p>
    );
  }
  if (state.type === "error") {
    return (
      <p role="alert" className="text-sm text-danger">
        Não foi possível carregar o pagamento agora. Atualize a página ou tente de novo em instantes.
      </p>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setPaying(true);
        // Só volta aqui se houver erro imediato; senão o comprador segue para a página do pedido
        // (Pix e boleto mostram as instruções antes). Quem confirma o pagamento é o aviso da Stripe no servidor.
        const r = await state.checkout.confirm();
        if (r.type === "error") setError(r.error.message);
        setPaying(false);
      }}
      className="space-y-4"
      data-testid="form-pagamento"
    >
      <PaymentElement options={{ layout: "accordion" }} />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant="buy" size="lg" className="w-full" disabled={paying}>
        {paying ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />} Pagar{" "}
        {formatBRL(amountCents)}
      </Button>
    </form>
  );
}

/** Pagamento dentro da Zexi: cartão, Pix ou boleto, sem sair do site. */
export function PaymentForm({ clientSecret, publishableKey, amountCents }: { clientSecret: string; publishableKey: string; amountCents: number }) {
  const stripe = useMemo(() => stripeFor(publishableKey), [publishableKey]);
  return (
    <CheckoutElementsProvider stripe={stripe} options={{ clientSecret, elementsOptions: { appearance } }}>
      <Form amountCents={amountCents} />
    </CheckoutElementsProvider>
  );
}
