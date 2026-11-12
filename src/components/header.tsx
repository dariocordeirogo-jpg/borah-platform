import Link from "next/link";
import { Suspense } from "react";
import { Gavel, Radio, Search, ShoppingBag, ShoppingCart, UserRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth";
import { categories } from "@/lib/demo-data";
import { getCartCount } from "@/lib/market/queries";

/** Os três modos de negociar ficam sempre visíveis e com ícone próprio. */
const mainLinks = [
  { href: "/market", label: "Comprar", icon: ShoppingBag },
  { href: "/ao-vivo", label: "Ao vivo", icon: Radio },
  { href: "/leiloes", label: "Leilões", icon: Gavel },
] as const;

async function AccountLink() {
  const user = await getCurrentUser();
  const firstName = user?.displayName.split(" ")[0];
  return (
    <Link
      href={user ? "/conta" : "/entrar"}
      className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium hover:bg-surface"
    >
      <UserRound className="h-5 w-5 text-brand" aria-hidden="true" />
      <span className="hidden sm:inline">{user ? `Olá, ${firstName}` : "Entrar"}</span>
      <span className="sr-only sm:hidden">{user ? "Minha conta" : "Entrar"}</span>
    </Link>
  );
}

function CartLinkView({ count }: { count: number }) {
  return (
    <Link
      href="/carrinho"
      aria-label={count ? `Carrinho, ${count} ${count === 1 ? "item" : "itens"}` : "Carrinho"}
      className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface"
    >
      <ShoppingCart className="h-5 w-5 text-brand" aria-hidden="true" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-navy px-1 text-[11px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

async function CartLink() {
  return <CartLinkView count={await getCartCount()} />;
}

function AccountFallback() {
  return (
    <span className="flex items-center gap-2 px-3 py-2 text-sm text-muted">
      <UserRound className="h-5 w-5 text-brand" aria-hidden="true" />
      <span className="hidden sm:inline">Conta</span>
    </span>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:gap-6">
        <Logo />
        <form action="/busca" role="search" className="hidden flex-1 md:block">
          <label htmlFor="busca-desktop" className="sr-only">
            Buscar na Zexi
          </label>
          <div className="flex h-11 items-center rounded-full border border-line bg-surface pl-4 focus-within:border-navy-2">
            <input
              id="busca-desktop"
              name="q"
              type="search"
              placeholder="Buscar produtos, lives e leilões"
              className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            />
            <button type="submit" aria-label="Buscar" className="mr-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white hover:bg-brand-dark">
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </form>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Suspense fallback={<AccountFallback />}>
            <AccountLink />
          </Suspense>
          <Suspense fallback={<CartLinkView count={0} />}>
            <CartLink />
          </Suspense>
        </div>
      </div>

      <form action="/busca" role="search" className="px-4 pb-3 md:hidden">
        <label htmlFor="busca-mobile" className="sr-only">
          Buscar na Zexi
        </label>
        <div className="flex h-11 items-center rounded-full border border-line bg-surface pl-4 focus-within:border-navy-2">
          <Search className="h-4 w-4 text-muted" aria-hidden="true" />
          <input
            id="busca-mobile"
            name="q"
            type="search"
            placeholder="O que você está procurando?"
            className="h-full flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted"
          />
        </div>
      </form>

      <nav aria-label="Principal" className="hidden border-t border-line md:block">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-4">
          {mainLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="my-1.5 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-navy hover:bg-brand-soft hover:text-brand-dark"
            >
              <l.icon className="h-4 w-4 text-brand" aria-hidden="true" />
              {l.label}
            </Link>
          ))}
          <Link href="/vender" className="my-1.5 rounded-full px-3 py-1.5 text-sm font-medium hover:bg-surface">
            Venda na Zexi
          </Link>
          <span className="mx-2 h-5 w-px bg-line" aria-hidden="true" />
          <div className="scrollbar-none flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {categories.slice(0, 6).map((c) => (
              <Link
                key={c.slug}
                href={`/market?categoria=${c.slug}`}
                className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface hover:text-ink"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}
