import Link from "next/link";
import { Logo } from "@/components/logo";
import { site } from "@/lib/site";

const groups = [
  {
    title: "Comprar",
    links: [
      { href: "/market", label: "Zexi Compras" },
      { href: "/ao-vivo", label: "Zexi Ao Vivo" },
      { href: "/leiloes", label: "Zexi Leilões" },
    ],
  },
  {
    title: "Vender e indicar",
    links: [
      { href: "/vender", label: "Zexi Vendedor" },
      { href: "/indique", label: "Indique e ganhe" },
    ],
  },
  {
    title: "Ajuda",
    links: [
      { href: "/ajuda", label: "Central de ajuda" },
      { href: "/como-comprar", label: "Como comprar" },
      { href: "/compra-garantida", label: "Compra Garantida" },
      { href: "/trocas-e-devolucoes", label: "Trocas e devoluções" },
    ],
  },
  {
    title: "Institucional",
    links: [
      { href: "/sobre", label: "Sobre a Zexi" },
      { href: "/categorias", label: "Categorias" },
      { href: "/termos", label: "Termos de uso" },
      { href: "/privacidade", label: "Política de privacidade" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-10 border-t border-line bg-white pb-24 text-navy md:pb-0">
      <a href="#" className="block bg-navy-2 py-3 text-center text-sm font-semibold text-white hover:bg-navy">
        Voltar ao início
      </a>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <div>
          <Logo />
          <p className="mt-4 font-display text-lg font-bold text-navy">{site.slogan}</p>
          <p className="mt-1 text-sm text-muted">{site.tagline}</p>
        </div>
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="text-sm font-bold text-brand">{g.title}</h2>
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
          © {site.name} · {site.productionDomain}
          {site.production
            ? " — intermediação de compra e venda entre lojas e compradores."
            : " — versão de testes. Lojas, produtos, leilões e transmissões podem ser de teste ou demonstração."}
        </p>
      </div>
    </footer>
  );
}
