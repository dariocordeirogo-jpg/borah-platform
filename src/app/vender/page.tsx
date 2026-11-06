import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Venda na LIVELANCE",
  description: "LIVELANCE SELLER: abra sua loja e venda com preço fixo, ao vivo ou em leilão.",
  alternates: { canonical: "/vender" },
};

export default function Page() {
  return (
    <ComingSoon
      phase="Fase 2"
      title="LIVELANCE SELLER"
      description="Central do vendedor: loja, produtos, estoque, pedidos e resultados. Depois, lives e leilões para vendedores verificados."
    />
  );
}
