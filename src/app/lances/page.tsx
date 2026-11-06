import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Lances" };

export default function Page() {
  return (
    <ComingSoon
      phase="Fase 3"
      title="BORAH LANCES"
      description="Leilões tradicionais e programados, com lance validado pelo servidor, anti-sniping e histórico público. Para dar lance será preciso ter CPF e telefone verificados."
    />
  );
}
