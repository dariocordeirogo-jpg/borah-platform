import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Leilões online",
  description: "LIVELANCE LEILÕES: lotes com lance inicial, incremento mínimo, cronômetro oficial e histórico de lances.",
  alternates: { canonical: "/leiloes" },
};

export default function Page() {
  return (
    <ComingSoon
      phase="Fase 3"
      title="LIVELANCE LEILÕES"
      description="Cadastro de lotes, lance inicial, incremento mínimo, cronômetro oficial, lances em tempo real validados pelo servidor, anti-sniping, histórico e registro da arrematação. Para dar lance será preciso ter CPF e telefone verificados."
    />
  );
}
