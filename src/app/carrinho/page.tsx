import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Carrinho" };

export default function Page() {
  return (
    <ComingSoon
      phase="Fase 2"
      title="Seu carrinho"
      description="O carrinho chega junto com o Market. Pagamentos reais só depois da homologação, na Fase 4."
    />
  );
}
