import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Market" };

export default function Page() {
  return (
    <ComingSoon
      phase="Fase 2"
      title="BORAH MARKET"
      description="Lojas, produtos, categorias, busca e carrinho para comprar na hora, sem disputa."
    />
  );
}
