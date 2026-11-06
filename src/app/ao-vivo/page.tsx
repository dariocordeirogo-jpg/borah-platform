import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Ao vivo" };

export default function Page() {
  return (
    <ComingSoon
      phase="Fase 7"
      title="BORAH AO VIVO"
      description="Transmissões de vendedores com chat, produto fixado na tela e leilões ao vivo usando o mesmo motor de lances."
    />
  );
}
