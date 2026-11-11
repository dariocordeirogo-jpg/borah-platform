import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExternalLink, Pin, PinOff } from "lucide-react";
import { LiveChat } from "@/components/live/chat";
import { LiveRefresh } from "@/components/live/live-refresh";
import { Notice } from "@/components/market";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { endLive, pinProduct, setPlayback, startLive, startLiveAuction } from "@/lib/live/actions";
import { liveAuctionMinutes, liveStatusLabel } from "@/lib/live/format";
import { getLive } from "@/lib/live/queries";
import { requireStore } from "@/lib/market/seller-guard";

export const metadata: Metadata = { title: "Estúdio da live" };
type SP = { erro?: string; nova?: string };

const input = "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm";

async function Studio({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const store = await requireStore(`/seller/lives/${id}`);
  const data = await getLive(id);
  if (!data || data.live.store_id !== store.id) notFound();
  const { live, products, auction, messages } = data;
  const isLive = live.status === "live";
  const auctionRunning = auction?.status === "active";

  return (
    <div className="space-y-4">
      <LiveRefresh liveId={live.id} />
      {sp.nova && <Notice tone="success">Live programada! Ela já aparece em “Próximas lives”.</Notice>}
      {sp.erro && <Notice tone="error">{sp.erro}</Notice>}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-white p-5">
        <div>
          <p className="text-xs font-semibold text-muted" data-testid="estado-live">
            {liveStatusLabel[live.status]}
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-navy">{live.title}</h1>
          <Link href={`/live/${live.id}`} className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
            Ver como público <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="flex gap-2">
          {live.status === "scheduled" && (
            <form action={startLive}>
              <input type="hidden" name="liveId" value={live.id} />
              <Button type="submit">Começar live</Button>
            </form>
          )}
          {(live.status === "scheduled" || isLive) && (
            <form action={endLive}>
              <input type="hidden" name="liveId" value={live.id} />
              <Button type="submit" variant="outline">
                {isLive ? "Encerrar live" : "Cancelar live"}
              </Button>
            </form>
          )}
        </div>
      </section>

      <section className="space-y-2 rounded-[var(--radius-card)] border border-line bg-white p-5 text-sm">
        <h2 className="font-semibold text-navy">Vídeo da transmissão</h2>
        <p className="text-muted">
          Transmita pelo serviço de vídeo (ex.: OBS ou celular) e cole aqui o link de reprodução HLS (https, termina em
          .m3u8). Quem estiver assistindo recebe o vídeo na hora.
        </p>
        <form action={setPlayback} className="flex gap-2">
          <input type="hidden" name="liveId" value={live.id} />
          <input name="playbackUrl" defaultValue={live.playback_url ?? ""} aria-label="Link de reprodução HLS" placeholder="https://.../live.m3u8" className={input} />
          <Button type="submit" variant="secondary">
            Salvar
          </Button>
        </form>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-[var(--radius-card)] border border-line bg-white" aria-label="Produtos da live">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-navy">Produtos</h2>
          <ul className="divide-y divide-line">
            {products.map((p) => {
              const pinned = live.pinned_product_id === p.id;
              return (
                <li key={p.id} className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm">
                      <span className="font-semibold text-navy">{p.title}</span>{" "}
                      <span className="text-muted">
                        {formatBRL(p.priceCents)} · estoque {p.stock}
                      </span>
                      {pinned && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">Em destaque</span>}
                    </span>
                    {isLive && (
                      <form action={pinProduct}>
                        <input type="hidden" name="liveId" value={live.id} />
                        {!pinned && <input type="hidden" name="productId" value={p.id} />}
                        <Button type="submit" size="sm" variant="outline" aria-label={pinned ? `Tirar destaque de ${p.title}` : `Destacar ${p.title}`}>
                          {pinned ? <PinOff className="h-4 w-4" aria-hidden="true" /> : <Pin className="h-4 w-4" aria-hidden="true" />}
                          {pinned ? "Tirar destaque" : "Destacar"}
                        </Button>
                      </form>
                    )}
                  </div>
                  {isLive && !auctionRunning && p.stock > 0 && (
                    <details className="rounded-xl bg-surface p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-navy">Leilão relâmpago</summary>
                      <form action={startLiveAuction} className="mt-3 grid gap-2 sm:grid-cols-4">
                        <input type="hidden" name="liveId" value={live.id} />
                        <input type="hidden" name="productId" value={p.id} />
                        <input name="starting" inputMode="decimal" placeholder="Lance inicial" aria-label={`Lance inicial de ${p.title}`} className={input} />
                        <input name="increment" inputMode="decimal" placeholder="Incremento" aria-label={`Incremento de ${p.title}`} className={input} />
                        <select name="minutes" aria-label={`Duração do leilão de ${p.title}`} className={input} defaultValue="5">
                          {liveAuctionMinutes.map((m) => (
                            <option key={m} value={m}>
                              {m} min
                            </option>
                          ))}
                        </select>
                        <Button type="submit" size="sm">
                          Abrir leilão
                        </Button>
                      </form>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
          {auctionRunning && auction && (
            <p className="border-t border-line p-4 text-sm text-navy">
              Leilão relâmpago em andamento: <Link href={`/leilao/${auction.id}`} className="font-semibold text-brand hover:underline">{auction.title}</Link>
            </p>
          )}
        </section>
        <LiveChat liveId={live.id} initial={messages} canSend={isLive} loggedIn moderator />
      </div>
    </div>
  );
}

export default function Page({ params, searchParams }: PageProps<"/seller/lives/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
      <Studio params={params} searchParams={searchParams as Promise<SP>} />
    </Suspense>
  );
}
