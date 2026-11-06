import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Vender na BORAH" };

export default function Page() {
  return (
    <ComingSoon
      phase="Fase 2"
      title="Abra sua loja"
      description="Cadastro de vendedor, loja, produtos e estoque. Depois, leilões e lives para os vendedores verificados."
    />
  );
}
