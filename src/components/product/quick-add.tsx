"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2, ShoppingCart } from "lucide-react";
import { addToCartQuick } from "@/lib/market/actions";

/** Botão redondo de carrinho sobre a foto do card: adiciona 1 unidade sem sair da vitrine. */
export function QuickAdd({ productId, title }: { productId: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={done ? `${title} adicionado ao carrinho` : `Adicionar ${title} ao carrinho`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await addToCartQuick({ productId, quantity: 1 });
          if (!r.ok) {
            if (r.login) router.push(r.login);
            return;
          }
          setDone(true);
          router.refresh();
          setTimeout(() => setDone(false), 2500);
        })
      }
      className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-brand shadow-[0_1px_4px_rgba(15,17,21,0.15)] transition-colors hover:bg-brand hover:text-white"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : done ? (
        <Check className="h-4 w-4 text-success" aria-hidden="true" />
      ) : (
        <ShoppingCart className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
