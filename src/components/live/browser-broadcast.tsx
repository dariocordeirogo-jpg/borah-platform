"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Square } from "lucide-react";
import { Notice } from "@/components/market";
import { Button } from "@/components/ui/button";
import { publish, type WebRtcSession } from "@/lib/live/webrtc";

type Phase = "off" | "preview" | "connecting" | "on" | "error";
type Facing = "user" | "environment";

const phaseLabel: Record<Phase, string> = {
  off: "Câmera desligada",
  preview: "Câmera ligada (ainda não está transmitindo)",
  connecting: "Conectando…",
  on: "Transmitindo",
  error: "Falhou",
};

/**
 * Estúdio: transmitir pela câmera do celular ou do computador (WebRTC/WHIP, Cloudflare Stream).
 * O endereço de envio é segredo da loja: chega só a esta tela do dono e não aparece escrito.
 */
export function BrowserBroadcast({ publishUrl }: { publishUrl: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const media = useRef<MediaStream | null>(null);
  const live = useRef<WebRtcSession | null>(null);
  const [phase, setPhase] = useState<Phase>("off");
  const [facing, setFacing] = useState<Facing>("user");
  const [error, setError] = useState<string | null>(null);

  const stopAll = async () => {
    await live.current?.stop();
    live.current = null;
    media.current?.getTracks().forEach((t) => t.stop());
    media.current = null;
    if (video.current) video.current.srcObject = null;
  };

  useEffect(() => () => void stopAll(), []);

  const openCamera = async (next: Facing) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador não libera a câmera. Use o Chrome, Safari ou Edge atualizados.");
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: next, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      return stream;
    } catch {
      setError("Não foi possível abrir a câmera. Permita o acesso à câmera e ao microfone no navegador.");
      return null;
    }
  };

  const turnOn = async () => {
    setError(null);
    const stream = await openCamera(facing);
    if (!stream) return setPhase("error");
    media.current = stream;
    if (video.current) video.current.srcObject = stream;
    setPhase("preview");
  };

  const goLive = async () => {
    if (!media.current) return;
    setError(null);
    setPhase("connecting");
    try {
      const s = await publish(media.current, publishUrl);
      live.current = s;
      s.pc.addEventListener("connectionstatechange", () => {
        if (s.pc.connectionState === "failed") {
          setError("A conexão caiu. Toque em “Transmitir” de novo.");
          setPhase("preview");
          void s.stop();
          if (live.current === s) live.current = null;
        }
      });
      setPhase("on");
    } catch {
      setError("O serviço de transmissão não aceitou a conexão agora. Tente de novo em instantes.");
      setPhase("preview");
    }
  };

  const stopLive = async () => {
    await live.current?.stop();
    live.current = null;
    setPhase(media.current ? "preview" : "off");
  };

  const turnOff = async () => {
    await stopAll();
    setPhase("off");
  };

  /** Troca frente/traseira sem derrubar a transmissão (substitui só a faixa de vídeo). */
  const flip = async () => {
    const next: Facing = facing === "user" ? "environment" : "user";
    const stream = await openCamera(next);
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    const sender = live.current?.pc.getSenders().find((s) => s.track?.kind === "video");
    await sender?.replaceTrack(track);
    media.current?.getVideoTracks().forEach((t) => {
      media.current?.removeTrack(t);
      t.stop();
    });
    stream.getAudioTracks().forEach((t) => t.stop());
    media.current?.addTrack(track);
    if (video.current) video.current.srcObject = media.current;
    setFacing(next);
    setPhase(live.current ? "on" : "preview");
  };

  const cameraOn = phase === "preview" || phase === "connecting" || phase === "on";

  return (
    <div className="space-y-3" data-testid="transmissao-navegador">
      <div className="relative aspect-[9/16] max-h-[60dvh] w-full overflow-hidden rounded-xl bg-navy md:aspect-video">
        <video
          ref={video}
          className={facing === "user" ? "h-full w-full -scale-x-100 object-cover" : "h-full w-full object-cover"}
          autoPlay
          muted
          playsInline
          aria-label="Prévia da sua câmera"
        />
        {!cameraOn && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">
            Ligue a câmera para ver a prévia antes de transmitir.
          </div>
        )}
        {phase === "on" && (
          <span className="absolute left-3 top-3 rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-white">Ao vivo</span>
        )}
      </div>
      <p className="text-muted">
        Status: <strong className="text-navy" data-testid="status-navegador">{phaseLabel[phase]}</strong>
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        {!cameraOn && (
          <Button type="button" onClick={turnOn}>
            <Camera className="h-4 w-4" aria-hidden="true" /> Ligar câmera
          </Button>
        )}
        {cameraOn && phase !== "on" && (
          <Button type="button" onClick={goLive} disabled={phase === "connecting"}>
            Transmitir
          </Button>
        )}
        {phase === "on" && (
          <Button type="button" variant="outline" onClick={stopLive}>
            <Square className="h-4 w-4" aria-hidden="true" /> Parar transmissão
          </Button>
        )}
        {cameraOn && (
          <Button type="button" variant="outline" onClick={flip} disabled={phase === "connecting"}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Trocar câmera
          </Button>
        )}
        {cameraOn && phase !== "on" && (
          <Button type="button" variant="outline" onClick={turnOff}>
            Desligar câmera
          </Button>
        )}
      </div>
      <p className="text-xs text-muted">
        Mantenha esta tela aberta durante a live: se fechar ou trocar de aba no celular, o vídeo para. Quando o vídeo
        estiver indo, toque em “Começar transmissão” para abrir a sala ao público.
      </p>
    </div>
  );
}
