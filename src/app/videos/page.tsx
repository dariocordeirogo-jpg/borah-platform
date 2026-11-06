import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Vídeos" };

export default function Page() {
  return (
    <ComingSoon
      phase="Fase 6"
      title="BORAH VÍDEOS"
      description="Feed vertical de vídeos curtos com produtos marcados: toque no produto e compre sem perder o vídeo."
    />
  );
}
