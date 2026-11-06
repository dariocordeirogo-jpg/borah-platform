import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Indique e ganhe" };

export default function Page() {
  return (
    <ComingSoon
      phase="Fase 5"
      title="BORAH INDICA"
      description="Links e cupons para divulgar produtos, com comissão pelas vendas atribuídas a você. A comissão só fica disponível depois da entrega e do prazo de devolução."
    />
  );
}
