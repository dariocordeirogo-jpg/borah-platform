import Link from "next/link";
import { Logo } from "@/components/logo";
import { site } from "@/lib/site";

const groups = [
  {
    title: "Comprar",
    links: [
      { href: "/market", label: "LIVELANCE MARKET" },
      { href: "/ao-vivo", label: "LIVELANCE LIVE" },
      { href: "/leiloes", label: "LIVELANCE LEILÕES" },
    ],
  },
  {
    title: "Vender e indicar",
    links: [
      { href: "/vender", label: "LIVELANCE SELLER" },
      { href: "/indique", label: "Indique e ganhe" },
    ],
  },
  {
    title: "Institucional",
    links: [
      { href: "/termos", label: "Termos de uso" },
      { href: "/privacidade", label: "Política de privacidade" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface pb-24 text-navy md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-4 font-display text-lg font-bold text-navy">{site.slogan}</p>
          <p className="mt-1 text-sm text-muted">{site.tagline}</p>
        </div>
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="text-sm font-bold uppercase tracking-wide text-brand">{g.title}</h2>
            <ul className="mt-3 space-y-2">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-navy-2 hover:text-brand hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-muted">
          © {site.name} · {site.productionDomain} — versão de desenvolvimento. Os leilões, lives, produtos e lojas
          exibidos são demonstrações.
        </p>
      </div>
    </footer>
  );
}
