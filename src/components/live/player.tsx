"use client";

import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { isWhepUrl, muxPlaybackId } from "@/lib/live/format";
import { play, type WebRtcSession } from "@/lib/live/webrtc";

/**
 * Player da live. Transmissão do Mux: Mux Player (baixa latência, carregado só quando precisa).
 * Transmissão pelo navegador (Cloudflare Stream): WebRTC/WHEP, menos de 1 s de atraso.
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
  const rtcRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const playbackId = muxPlaybackId(src);
  const whep = isWhepUrl(src) ? src : null;

  // WebRTC (WHEP): enquanto a loja não liga a câmera a Cloudflare recusa; tenta de novo a cada 5 s
  useEffect(() => {
    const video = rtcRef.current;
    if (!video || !whep || status !== "live") return;
    let current: WebRtcSession | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const retry = () => {
      if (!stopped) timer = setTimeout(connect, 5000);
    };
    const connect = async () => {
      try {
        const s = await play(whep, (media) => {
          if (video.srcObject !== media) video.srcObject = media;
          setWaiting(false);
        });
        if (stopped) return void s.stop();
        current = s;
        s.pc.addEventListener("connectionstatechange", () => {
          if (s.pc.connectionState === "failed" || s.pc.connectionState === "closed") {
            void s.stop();
            if (current === s) current = null;
            setWaiting(true);
            retry();
          }
        });
      } catch {
        setWaiting(true);
        retry();
      }
    };
    void connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      void current?.stop();
      video.srcObject = null;
    };
  }, [whep, status]);

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
    if (!video || !src || playbackId || whep || status !== "live") return;
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
  }, [src, playbackId, whep, status]);

  const message =
    status === "scheduled"
      ? "A transmissão ainda não começou."
      : status === "ended" || status === "cancelled"
        ? "Esta live terminou."
        : !src
          ? "A loja está preparando a transmissão. Fique por aqui!"
          : failed
            ? "Não foi possível carregar o vídeo agora. Tente recarregar a página."
            : waiting
              ? "A loja está ligando a câmera. O vídeo começa sozinho em instantes."
              : null;

  return (
    <div className="relative aspect-[9/16] max-h-[78dvh] w-full overflow-hidden rounded-[var(--radius-card)] bg-navy md:aspect-video">
      {status === "live" && playbackId && !failed && <div ref={muxRef} className="h-full w-full" />}
      {status === "live" && whep && (
        <video ref={rtcRef} className="h-full w-full object-contain" autoPlay muted playsInline controls data-testid="live-video" />
      )}
      {status === "live" && src && !playbackId && !whep && !failed && (
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
