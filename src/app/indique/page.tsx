import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Indique e ganhe", alternates: { canonical: "/indique" } };

export default function Page() {
  return (
    <ComingSoon
      phase="Fase 5"
      title="Indique e ganhe"
      description="Links e cupons para divulgar produtos da LIVELANCE, com comissão pelas vendas atribuídas a você. A comissão só fica disponível depois da entrega e do prazo de devolução."
    />
  );
}
