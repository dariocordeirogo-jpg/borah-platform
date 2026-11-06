import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = {
  title: "Vendas ao vivo",
  description: "LIVELANCE LIVE: transmissões de venda com chat, produtos vinculados, carrinho e ofertas em tempo real.",
  alternates: { canonical: "/ao-vivo" },
};

export default function Page() {
  return (
    <ComingSoon
      phase="Fase 7"
      title="LIVELANCE LIVE"
      description="Transmissões ao vivo com vídeo em tempo real, chat, produtos vinculados à live, carrinho, ofertas relâmpago, moderação e leilões ao vivo usando o mesmo motor de lances."
    />
  );
}
