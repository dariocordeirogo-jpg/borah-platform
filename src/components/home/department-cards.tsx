import Image from "next/image";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { listProducts, type ProductCardData } from "@/lib/market/queries";

/* Cartões de departamento com 4 produtos cada, logo abaixo do carrossel (padrão das grandes lojas online). */

const departments = [
  { slug: "eletronicos", title: "Eletrônicos e tecnologia" },
  { slug: "casa", title: "Casa e cozinha" },
  { slug: "moda", title: "Moda e acessórios" },
] as const;

function DeptCard({ title, href, items }: { title: string; href: string; items: ProductCardData[] }) {
  return (
    <section className="flex h-full flex-col rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(15,17,21,0.08)]">
      <h2 className="font-display text-base font-bold tracking-tight text-navy md:text-lg">{title}</h2>
      <ul className="mt-3 grid flex-1 grid-cols-2 gap-3">
        {items.map((p) => (
          <li key={p.id}>
            <Link href={`/produto/${p.id}`} className="group block">
              <span className="relative block aspect-square overflow-hidden rounded-md bg-surface">
                {p.imageUrl ? (
                  <Image src={p.imageUrl} alt={p.title} fill sizes="(max-width: 768px) 40vw, 12vw" className="object-contain p-1 transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <ImageOff className="absolute inset-0 m-auto h-7 w-7 text-muted" aria-hidden="true" />
                )}
              </span>
              <span className="mt-1 line-clamp-1 text-xs text-ink/80 group-hover:text-brand">{p.title}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href={href} className="mt-3 text-sm font-semibold text-brand hover:text-brand-dark hover:underline">
        Ver mais
      </Link>
    </section>
  );
}

export async function DepartmentCards() {
  const [byDept, all] = await Promise.all([
    Promise.all(departments.map((d) => listProducts({ categorySlug: d.slug, limit: 4 }))),
    listProducts({ limit: 4 }),
  ]);
  const cards: { title: string; href: string; items: ProductCardData[] }[] = departments
    .map((d, i) => ({ title: d.title, href: `/market?categoria=${d.slug}`, items: byDept[i].items }))
    .filter((c) => c.items.length >= 2);
  if (all.items.length >= 2) cards.push({ title: "Novidades no Market", href: "/market", items: all.items });
  if (!cards.length) return null;
  return (
    <div data-testid="departamentos" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.slice(0, 4).map((c) => (
        <DeptCard key={c.title} {...c} />
      ))}
    </div>
  );
}
