"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Gavel, LayoutDashboard, Package, Receipt, Settings, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/seller", label: "Visão geral", icon: LayoutDashboard },
  { href: "/seller/produtos", label: "Produtos", icon: Package },
  { href: "/seller/leiloes", label: "Leilões", icon: Gavel },
  { href: "/seller/pedidos", label: "Pedidos", icon: Receipt },
  { href: "/seller/pagamentos", label: "Pagamentos", icon: Wallet },
  { href: "/seller/loja", label: "Loja", icon: Settings },
];

/** Navegação do painel do vendedor (azul-marinho; item ativo em vermelho). */
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
  return (
    <nav aria-label="Painel do vendedor" className="rounded-[var(--radius-card)] bg-navy p-2 text-white md:p-3">
      <p className="hidden px-3 pb-2 pt-1 text-[11px] font-bold tracking-wider text-white/70 md:block">LIVELANCE SELLER</p>
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/seller" ? pathname === "/seller" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium",
                  active ? "bg-white text-navy" : "text-white/85 hover:bg-white/10",
                )}
              >
                <Icon className={cn("h-4 w-4", active && "text-brand")} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
