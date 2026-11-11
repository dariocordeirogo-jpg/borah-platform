"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Heart, ShoppingBag, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { addToCart } from "@/lib/market/actions";
import { registerView, toggleLike } from "@/lib/videos/actions";
import { compactCount } from "@/lib/videos/format";
import type { FeedVideo } from "@/lib/videos/queries";
import { cn } from "@/lib/utils";

/** Feed vertical: um vídeo por tela, toca sozinho (sem som) quando aparece e pausa quando sai. */
export function VideoFeed({ videos, loggedIn }: { videos: FeedVideo[]; loggedIn: boolean }) {
  const [muted, setMuted] = useState(true);
  return (
    <div
      className="h-[calc(100dvh-8.5rem)] snap-y snap-mandatory overflow-y-auto rounded-[var(--radius-card)] bg-black md:h-[calc(100dvh-10rem)]"
      aria-label="Vídeos"
    >
      {videos.map((v) => (
        <VideoItem key={v.id} video={v} loggedIn={loggedIn} muted={muted} onToggleMute={() => setMuted((m) => !m)} />
      ))}
    </div>
  );
}

function VideoItem({
  video,
  loggedIn,
  muted,
  onToggleMute,
}: {
  video: FeedVideo;
  loggedIn: boolean;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const counted = useRef(false);
  const [like, setLike] = useState({ liked: video.liked, likes: video.likes });
  const [pending, start] = useTransition();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
          if (!counted.current) {
            counted.current = true;
            void registerView(video.id);
          }
        } else {
          el.pause();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [video.id]);

  const p = video.product;
  return (
    <article className="relative h-full snap-start snap-always" aria-label={`Vídeo de ${video.store.name}: ${p.title}`} data-testid="video-item">
      <video
        ref={ref}
        src={video.url}
        className="h-full w-full object-contain"
        loop
        muted={muted}
        playsInline
        preload="metadata"
        onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play().catch(() => {}) : e.currentTarget.pause())}
      />

      <div className="absolute right-3 top-3 flex flex-col gap-3">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? "Ligar som" : "Desligar som"}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white"
        >
          {muted ? <VolumeX className="h-5 w-5" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      <div className="absolute bottom-40 right-3 flex flex-col items-center gap-1 text-white">
        {loggedIn ? (
          <button
            type="button"
            disabled={pending}
            aria-pressed={like.liked}
            aria-label={like.liked ? "Descurtir" : "Curtir"}
            onClick={() =>
              start(async () => {
                const res = await toggleLike(video.id);
                if ("liked" in res) setLike(res);
              })
            }
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50"
          >
            <Heart className={cn("h-6 w-6", like.liked && "fill-brand text-brand")} aria-hidden="true" />
          </button>
        ) : (
          <Link href="/entrar?next=/videos" aria-label="Entrar para curtir" className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50">
            <Heart className="h-6 w-6" aria-hidden="true" />
          </Link>
        )}
        <span className="text-xs font-semibold" data-testid="curtidas">
          {compactCount(like.likes)}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-3 pt-10 text-white">
        <Link href={`/loja/${video.store.slug}`} className="text-sm font-bold hover:underline">
          {video.store.name}
        </Link>
        {video.caption && <p className="line-clamp-2 text-sm text-white/90">{video.caption}</p>}
        <div className="flex items-center gap-3 rounded-xl bg-white p-2 text-ink">
          <Link href={`/produto/${p.id}`} className="flex min-w-0 flex-1 items-center gap-2">
            {p.imageUrl ? (
              <Image src={p.imageUrl} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface">
                <ShoppingBag className="h-5 w-5 text-muted" aria-hidden="true" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-navy">{p.title}</span>
              <span className="block text-sm font-bold text-navy">{formatBRL(p.priceCents)}</span>
            </span>
          </Link>
          {p.stock > 0 ? (
            <form action={addToCart}>
              <input type="hidden" name="productId" value={p.id} />
              <input type="hidden" name="quantity" value="1" />
              <input type="hidden" name="buyNow" value="1" />
              <Button type="submit" variant="buy" size="sm">
                Comprar agora
              </Button>
            </form>
          ) : (
            <span className="shrink-0 text-xs font-semibold text-muted">Esgotado</span>
          )}
        </div>
      </div>
    </article>
  );
}
