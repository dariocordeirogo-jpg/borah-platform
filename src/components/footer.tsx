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
    <footer className="mt-16 bg-green-night pb-24 text-white md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <Logo mono className="text-white" />
          <p className="mt-4 font-display text-lg font-bold text-gold-light">{site.slogan}</p>
          <p className="mt-1 text-sm text-white/80">{site.tagline}</p>
        </div>
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="text-sm font-semibold text-gold-light">{g.title}</h2>
            <ul className="mt-3 space-y-2">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-white/85 hover:text-white hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/15">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-white/75">
          © {site.name} · {site.productionDomain} — versão de desenvolvimento. Os leilões, lives, produtos e lojas
          exibidos são demonstrações.
        </p>
      </div>
    </footer>
  );
}
