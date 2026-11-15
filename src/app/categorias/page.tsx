import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCategories } from "@/lib/market/queries";

export const metadata: Metadata = { title: "Categorias", description: "Todas as categorias de produtos da Zexi.", alternates: { canonical: "/categorias" } };

async function List() {
  const categories = await getCategories();
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {categories.map((c) => (
        <li key={c.slug}>
          <Link
            href={`/market?categoria=${c.slug}`}
            className="block rounded-[var(--radius-card)] border border-line bg-white px-4 py-5 font-semibold text-navy hover:border-brand hover:text-brand"
          >
            {c.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Page() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 font-display text-3xl font-bold tracking-tight text-navy">Categorias</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <List />
      </Suspense>
    </div>
  );
}
