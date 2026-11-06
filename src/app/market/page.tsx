import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "LIVELANCE MARKET: compre de lojas brasileiras com preço fixo, carrinho e entrega.",
  alternates: { canonical: "/market" },
};

export default function Page() {
  return (
    <ComingSoon
      phase="Fase 2"
      title="LIVELANCE MARKET"
      description="Lojas, produtos, categorias, busca, carrinho e pedidos para comprar na hora, sem disputa."
    />
  );
}
