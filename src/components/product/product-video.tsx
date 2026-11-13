import { ExternalLink, PlayCircle } from "lucide-react";
import { parseVideoUrl, videoProviderName } from "@/lib/market/video";
import { cn } from "@/lib/utils";

/** Vídeo do produto embutido na página (player oficial do YouTube, Instagram ou Facebook). */
export function ProductVideo({ url, title }: { url: string | null | undefined; title: string }) {
  const v = parseVideoUrl(url);
  if (!v) return null;
  return (
    <section aria-label="Vídeo do produto" data-testid="video-produto" className="rounded-[var(--radius-card)] border border-line bg-white p-3">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy">
        <PlayCircle className="h-4 w-4 text-brand" aria-hidden="true" /> Vídeo do produto
      </h2>
      <div
        className={cn(
          "relative mx-auto w-full overflow-hidden rounded-lg bg-black",
          v.orientation === "landscape" ? "aspect-video" : "aspect-[9/16] max-h-[640px] max-w-[360px]",
        )}
      >
        <iframe
          src={v.embedUrl}
          title={`Vídeo: ${title}`}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
      <a
        href={v.watchUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-brand hover:underline"
      >
        Abrir no {videoProviderName[v.provider]} <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    </section>
  );
}
