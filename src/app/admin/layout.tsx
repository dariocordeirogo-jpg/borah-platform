import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/admin/guard";

const items = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/denuncias", label: "Denúncias" },
  { href: "/admin/moderacao", label: "Moderação" },
  { href: "/admin/lojas", label: "Lojas" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/frete", label: "Frete" },
];

/** Só a equipe vê o menu e as páginas; para os demais a área não existe (404). */
async function Gate({ children }: { children: React.ReactNode }) {
  await requireStaff("/admin");
  return (
    <>
      <nav aria-label="Painel da equipe" className="mb-5 flex gap-1 overflow-x-auto rounded-[var(--radius-card)] bg-navy p-2 text-sm text-white">
        <span className="hidden px-3 py-2 text-[11px] font-bold tracking-wider text-white/70 md:block">Zexi ADMIN</span>
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="whitespace-nowrap rounded-lg px-3 py-2 font-medium hover:bg-white/10">
            {i.label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Gate>{children}</Gate>
      </Suspense>
    </div>
  );
}
