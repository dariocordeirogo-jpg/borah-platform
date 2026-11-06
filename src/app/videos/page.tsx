import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Vídeos", alternates: { canonical: "/videos" } };

export default function Page() {
  return (
    <ComingSoon
      phase="Fase 6"
      title="Vídeos do LIVELANCE LIVE"
      description="Vídeos curtos com produtos marcados e replays das transmissões: toque no produto e compre sem sair do vídeo."
    />
  );
}
