"use client";

import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";

/**
 * Player HLS: Safari toca .m3u8 nativamente; nos demais navegadores usa hls.js (carregado só quando precisa).
 * Funciona com qualquer serviço de transmissão que entregue HLS.
 */
export function LivePlayer({ src, status }: { src: string | null; status: "scheduled" | "live" | "ended" | "cancelled" }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src || status !== "live") return;
    let destroy: (() => void) | undefined;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else {
      void import("hls.js").then(({ default: Hls }) => {
        if (!Hls.isSupported()) return setFailed(true);
        const hls = new Hls({ lowLatencyMode: true });
        hls.on(Hls.Events.ERROR, (_e, data) => data.fatal && setFailed(true));
        hls.loadSource(src);
        hls.attachMedia(video);
        destroy = () => hls.destroy();
      });
    }
    return () => destroy?.();
  }, [src, status]);

  const message =
    status === "scheduled"
      ? "A transmissão ainda não começou."
      : status === "ended" || status === "cancelled"
        ? "Esta live terminou."
        : !src
          ? "A loja está preparando a transmissão. Fique por aqui!"
          : failed
            ? "Não foi possível carregar o vídeo agora. Tente recarregar a página."
            : null;

  return (
    <div className="relative aspect-[9/16] max-h-[78dvh] w-full overflow-hidden rounded-[var(--radius-card)] bg-navy md:aspect-video">
      {status === "live" && src && !failed && (
        <video ref={ref} className="h-full w-full object-contain" autoPlay muted playsInline controls data-testid="live-video" />
      )}
      {message && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
          <Radio className="h-10 w-10 text-brand" aria-hidden="true" />
          <p className="max-w-xs text-sm" data-testid="live-player-status">
            {message}
          </p>
        </div>
      )}
      {status === "live" && (
        <span className="absolute left-3 top-3 rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-white">AO VIVO</span>
      )}
    </div>
  );
}
