import Link from "next/link";
import { Search } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

const shortcuts = [
  { href: "/ofertas", label: "Ofertas" },
  { href: "/market", label: "Comprar" },
  { href: "/ao-vivo", label: "Ao vivo" },
  { href: "/leiloes", label: "Leilões" },
  { href: "/categorias", label: "Categorias" },
  { href: "/ajuda", label: "Ajuda" },
];

/** Página não encontrada (404): busca e atalhos para continuar navegando. */
export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl px-4 py-20 text-center" data-testid="pagina-404">
      <p className="font-display text-6xl font-extrabold text-brand">404</p>
      <h1 className="mt-3 font-display text-2xl font-bold text-navy">Página não encontrada</h1>
      <p className="mt-2 text-muted">O endereço pode ter mudado ou não existe. Que tal buscar o que você procura?</p>
      <form action="/busca" role="search" className="mx-auto mt-6 flex h-12 max-w-md items-center rounded-md border border-line bg-white pl-4 focus-within:border-navy-2">
        <label htmlFor="busca-404" className="sr-only">
          Buscar na Zexi
        </label>
        <input id="busca-404" name="q" type="search" placeholder="Buscar produtos, transmissões e leilões" className="h-full flex-1 bg-transparent text-sm outline-none" />
        <button type="submit" aria-label="Buscar" className="mr-1 flex h-10 w-10 items-center justify-center rounded-md text-navy hover:bg-surface">
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
      <ul className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
        {shortcuts.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="block rounded-full border border-line bg-white px-4 py-1.5 text-navy hover:border-brand hover:text-brand">
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
      <ButtonLink href="/" className="mt-8">
        Voltar para o início
      </ButtonLink>
    </section>
  );
}
