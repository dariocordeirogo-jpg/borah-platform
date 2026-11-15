"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { addToCartQuick } from "@/lib/market/actions";

/**
 * Compra no produto, no jeito dos grandes marketplaces:
 * "Comprar agora" põe no carrinho e vai direto para a finalização; "Adicionar ao carrinho" não sai da página.
 * No celular, uma barra fixa com o preço e o botão de comprar acompanha a rolagem.
 */
export function BuyBox({ productId, stock, priceCents, title }: { productId: string; stock: number; priceCents: number; title: string }) {
  const router = useRouter();
  const max = Math.min(stock, 99);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [action, setAction] = useState<"buy" | "cart" | null>(null);
  const [showBar, setShowBar] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Barra fixa do celular só aparece quando os botões principais saem da tela
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const run = (buyNow: boolean) => {
    setError(null);
    setAction(buyNow ? "buy" : "cart");
    start(async () => {
      const r = await addToCartQuick({ productId, quantity: qty, buyNow });
      if (!r.ok) {
        if (r.login) router.push(r.login);
        else setError(r.error ?? "Não foi possível adicionar agora.");
        return;
      }
      if (buyNow) {
        router.push("/checkout");
        return;
      }
      setAdded(qty);
      router.refresh(); // atualiza o número do carrinho no topo
    });
  };

  return (
    <>
      <div ref={boxRef} className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-md bg-surface px-3 py-2 text-sm">
          <span className="text-ink">
            Quantidade: <strong data-testid="quantidade">{qty}</strong>
            <span className="block text-xs text-muted">
              {stock} {stock === 1 ? "disponível" : "disponíveis"}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              aria-label="Diminuir quantidade"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-navy disabled:opacity-40"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <label className="sr-only" htmlFor="quantity">
              Quantidade
            </label>
            <select
              id="quantity"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="h-8 rounded-md border border-line bg-white px-1 text-sm font-semibold"
            >
              {Array.from({ length: Math.min(max, 10) }, (_, i) => i + 1)
                .concat(max > 10 ? [max] : [])
                .filter((n, i, a) => a.indexOf(n) === i)
                .map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "unidade" : "unidades"}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(max, q + 1))}
              disabled={qty >= max}
              aria-label="Aumentar quantidade"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-navy disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        </div>
        {qty > 1 && <p className="text-xs text-muted">Total: {formatBRL(priceCents * qty)}</p>}
        <Button type="button" variant="buy" size="lg" className="w-full" disabled={pending} onClick={() => run(true)}>
          {pending && action === "buy" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null} Comprar agora
        </Button>
        <Button type="button" variant="outline" size="lg" className="w-full" disabled={pending} onClick={() => run(false)}>
          {pending && action === "cart" ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <ShoppingCart className="h-5 w-5" aria-hidden="true" />
          )}{" "}
          Adicionar ao carrinho
        </Button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {added !== null && (
          <div role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success" data-testid="adicionado">
            <p className="flex items-center gap-1.5 font-semibold">
              <Check className="h-4 w-4" aria-hidden="true" /> {added === 1 ? "Adicionado" : `${added} unidades adicionadas`} ao carrinho
            </p>
            <p className="mt-1 flex flex-wrap gap-x-4">
              <Link href="/carrinho" className="font-semibold underline">
                Ver carrinho
              </Link>
              <Link href="/checkout" className="font-semibold underline">
                Finalizar compra
              </Link>
            </p>
          </div>
        )}
      </div>

      {/* Celular: barra fixa de compra */}
      <div
        aria-hidden={!showBar}
        // Fica logo acima da barra de navegação do aplicativo (que também é fixa no rodapé do celular)
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
        className={`fixed inset-x-0 z-30 border-t border-line bg-white px-4 py-2.5 shadow-[0_-2px_8px_rgba(15,17,21,0.08)] transition-opacity md:hidden ${
          showBar ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        data-testid="barra-compra"
      >
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted">{title}</p>
            <p className="text-lg font-semibold text-ink">{formatBRL(priceCents)}</p>
          </div>
          <Button type="button" variant="buy" disabled={pending} tabIndex={showBar ? 0 : -1} onClick={() => run(true)}>
            Comprar agora
          </Button>
        </div>
      </div>
    </>
  );
}
