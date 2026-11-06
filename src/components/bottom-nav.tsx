"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gavel, Home, PlaySquare, Radio, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Início", icon: Home },
  { href: "/lances", label: "Lances", icon: Gavel },
  { href: "/ao-vivo", label: "Ao vivo", icon: Radio },
  { href: "/videos", label: "Vídeos", icon: PlaySquare },
  { href: "/conta", label: "Conta", icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação do aplicativo"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                  active ? "text-green-deep" : "text-muted",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-green")} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
