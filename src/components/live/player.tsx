"use client";

import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { muxPlaybackId } from "@/lib/live/format";

/**
 * Player da live. Transmissão do Mux: Mux Player (baixa latência, carregado só quando precisa).
 * Outros serviços: HLS puro — Safari toca .m3u8 nativamente; nos demais navegadores usa hls.js.
 */
export function LivePlayer({
  src,
  status,
  title,
}: {
  src: string | null;
  status: "scheduled" | "live" | "ended" | "cancelled";
  title?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const muxRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const playbackId = muxPlaybackId(src);

  // Mux Player: web component criado no navegador (não roda no servidor)
  useEffect(() => {
    const box = muxRef.current;
    if (!box || !playbackId || status !== "live") return;
    let cancelled = false;
    void import("@mux/mux-player").then(() => {
      if (cancelled) return;
      const el = document.createElement("mux-player");
      el.setAttribute("playback-id", playbackId);
      el.setAttribute("stream-type", "ll-live");
      el.setAttribute("autoplay", "muted");
      el.setAttribute("muted", "");
      el.setAttribute("playsinline", "");
      el.setAttribute("accent-color", "#FF4D2D");
      el.setAttribute("default-hidden-captions", "");
      if (title) el.setAttribute("metadata-video-title", title);
      el.setAttribute("data-testid", "live-video");
      el.style.width = "100%";
      el.style.height = "100%";
      el.addEventListener("error", () => setFailed(true));
      box.replaceChildren(el);
    }, () => setFailed(true));
    return () => {
      cancelled = true;
      box.replaceChildren();
    };
  }, [playbackId, status, title]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src || playbackId || status !== "live") return;
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
  }, [src, playbackId, status]);

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
      {status === "live" && playbackId && !failed && <div ref={muxRef} className="h-full w-full" />}
      {status === "live" && src && !playbackId && !failed && (
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
