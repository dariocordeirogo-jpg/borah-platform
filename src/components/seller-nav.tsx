"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Clapperboard, Gavel, LayoutDashboard, Link2, Package, PlusCircle, Radio, Receipt, Settings, TicketPercent, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/seller", label: "Visão geral", icon: LayoutDashboard },
  { href: "/seller/pedidos", label: "Vendas", icon: Receipt },
  { href: "/seller/produtos", label: "Anúncios", icon: Package },
  { href: "/seller/produtos/importar", label: "Importar anúncios", icon: Link2 },
  { href: "/seller/leiloes", label: "Leilões", icon: Gavel },
  { href: "/seller/videos", label: "Vídeos", icon: Clapperboard },
  { href: "/seller/lives", label: "Lives", icon: Radio },
  { href: "/seller/cupons", label: "Cupons", icon: TicketPercent },
  { href: "/seller/pagamentos", label: "Pagamentos", icon: Wallet },
  { href: "/seller/loja", label: "Loja", icon: Settings },
];

/** Navegação do painel do vendedor (barra lateral branca; item ativo em laranja; "Anunciar" em destaque). */
export function SellerNav() {
  return (
    <Suspense fallback={<SellerNavView pathname="" />}>
      <SellerNavWithPath />
    </Suspense>
  );
}

function SellerNavWithPath() {
  return <SellerNavView pathname={usePathname()} />;
}

function SellerNavView({ pathname }: { pathname: string }) {
  // O item mais específico que casa com a rota fica ativo (ex.: "Importar anúncios" e não "Anúncios")
  const activeHref = items
    .filter(({ href }) => (href === "/seller" ? pathname === "/seller" : pathname === href || pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label="Painel do vendedor" className="rounded-xl border border-line bg-white p-2 md:p-3">
      <p className="hidden px-3 pb-2 pt-1 text-[11px] font-bold tracking-wider text-brand md:block">ZEXI SELLER</p>
      <Link
        href="/seller/produtos/novo"
        className="mb-2 hidden items-center justify-center gap-2 rounded-full bg-brand px-3 py-2.5 text-sm font-bold text-white hover:bg-brand-dark md:flex"
      >
        <PlusCircle className="h-4 w-4" aria-hidden="true" /> Anunciar
      </Link>
      <ul className="scrollbar-none flex gap-1 overflow-x-auto md:flex-col">
        <li className="md:hidden">
          <Link href="/seller/produtos/novo" className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-brand px-3 py-2 text-sm font-bold text-white">
            <PlusCircle className="h-4 w-4" aria-hidden="true" /> Anunciar
          </Link>
        </li>
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === activeHref;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium md:rounded-lg",
                  active ? "bg-brand-soft font-semibold text-brand-dark" : "text-ink hover:bg-surface",
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-brand" : "text-muted")} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
