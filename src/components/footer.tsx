import Link from "next/link";
import { Logo } from "@/components/logo";

const groups = [
  {
    title: "Comprar",
    links: [
      { href: "/lances", label: "Leilões" },
      { href: "/ao-vivo", label: "Ao vivo" },
      { href: "/market", label: "Market" },
      { href: "/videos", label: "Vídeos" },
    ],
  },
  {
    title: "Vender e ganhar",
    links: [
      { href: "/vender", label: "Abrir minha loja" },
      { href: "/indique", label: "Indique e ganhe" },
    ],
  },
  {
    title: "Institucional",
    links: [
      { href: "/termos", label: "Termos de uso" },
      { href: "/privacidade", label: "Privacidade" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface pb-24 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 text-sm font-semibold text-green-deep">Assista. Compre. Venda. Ganhe.</p>
          <p className="mt-1 text-sm text-muted">O comércio acontece aqui.</p>
        </div>
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="text-sm font-semibold">{g.title}</h2>
            <ul className="mt-3 space-y-2">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted hover:text-green-deep">
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
          BORAH — versão de desenvolvimento. Os leilões, produtos e lojas exibidos são demonstrações.
        </p>
      </div>
    </footer>
  );
}
