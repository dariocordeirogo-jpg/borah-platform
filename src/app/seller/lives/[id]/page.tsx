import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { ExternalLink, Gavel, Pin, PinOff, ShoppingBag } from "lucide-react";
import { LiveChat } from "@/components/live/chat";
import { LiveRefresh } from "@/components/live/live-refresh";
import { Notice } from "@/components/market";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { endLive, openStream, pinProduct, setPlayback, startLive, startLiveAuction } from "@/lib/live/actions";
import { liveAuctionMinutes, liveStatusLabel } from "@/lib/live/format";
import { getLive, getStudioStream, type StudioStream } from "@/lib/live/queries";
import { requireStore } from "@/lib/market/seller-guard";

export const metadata: Metadata = { title: "Estúdio da live" };
type SP = { erro?: string; nova?: string };

const input = "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm";
/** 12345 → "123,45" (valor sugerido nos campos; quem decide e valida é o banco) */
const asInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const suggestedStart = (price: number) => Math.max(100, Math.round(price / 2 / 100) * 100);
const suggestedIncrement = (price: number) => Math.max(100, Math.round((price * 0.02) / 100) * 100);

async function Studio({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const store = await requireStore(`/seller/lives/${id}`);
  const data = await getLive(id);
  if (!data || data.live.store_id !== store.id) notFound();
  const { live, products, auction, messages } = data;
  const stream: StudioStream =
    live.status === "scheduled" || live.status === "live" ? await getStudioStream(live.id) : { kind: "none" };
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

      {(live.status === "scheduled" || isLive) && <StreamPanel liveId={live.id} playbackUrl={live.playback_url} stream={stream} />}

      <div className="grid grid-cols-1 gap-4 [&>*]:min-w-0 lg:grid-cols-[1fr_360px]">
        <section className="rounded-[var(--radius-card)] border border-line bg-white" aria-label="Produtos da live">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-navy">Produtos</h2>
          <ul className="divide-y divide-line">
            {products.map((p) => {
              const pinned = live.pinned_product_id === p.id;
              const canAuction = isLive && !auctionRunning && p.stock > 0;
              return (
                <li key={p.id} className="space-y-3 p-4">
                  <div className="flex items-center gap-3">
                    {p.imageUrl ? (
                      <Image src={p.imageUrl} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-lg border border-line object-contain" />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface">
                        <ShoppingBag className="h-5 w-5 text-muted" aria-hidden="true" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block truncate font-semibold text-navy">{p.title}</span>
                      <span className="text-muted">
                        {formatBRL(p.priceCents)} · estoque {p.stock}
                      </span>
                      {pinned && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">À venda agora</span>}
                    </span>
                  </div>
                  {isLive && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Como vender agora</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <form action={pinProduct}>
                          <input type="hidden" name="liveId" value={live.id} />
                          {!pinned && <input type="hidden" name="productId" value={p.id} />}
                          <Button
                            type="submit"
                            variant={pinned ? "secondary" : "outline"}
                            className="w-full"
                            aria-label={pinned ? `Tirar destaque de ${p.title}` : `Destacar ${p.title}`}
                          >
                            {pinned ? <PinOff className="h-4 w-4" aria-hidden="true" /> : <Pin className="h-4 w-4" aria-hidden="true" />}
                            {pinned ? "Tirar da vitrine" : "Vender a preço fixo"}
                          </Button>
                        </form>
                        {canAuction ? (
                          <details className="group rounded-full sm:col-span-1 [&[open]]:col-span-full [&[open]]:rounded-xl [&[open]]:bg-surface [&[open]]:p-3">
                            <summary className="flex h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-full border border-brand px-4 text-sm font-semibold text-brand hover:bg-brand-soft group-open:mb-3 group-open:h-auto group-open:justify-start group-open:border-0 group-open:px-0 [&::-webkit-details-marker]:hidden">
                              <Gavel className="h-4 w-4" aria-hidden="true" /> Leiloar ao vivo
                            </summary>
                            <form action={startLiveAuction} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              <input type="hidden" name="liveId" value={live.id} />
                              <input type="hidden" name="productId" value={p.id} />
                              <label className="text-xs text-muted">
                                Lance inicial (R$)
                                <input name="starting" inputMode="decimal" defaultValue={asInput(suggestedStart(p.priceCents))} aria-label={`Lance inicial de ${p.title}`} className={input} />
                              </label>
                              <label className="text-xs text-muted">
                                Incremento (R$)
                                <input name="increment" inputMode="decimal" defaultValue={asInput(suggestedIncrement(p.priceCents))} aria-label={`Incremento de ${p.title}`} className={input} />
                              </label>
                              <label className="text-xs text-muted">
                                Duração
                                <select name="minutes" aria-label={`Duração do leilão de ${p.title}`} className={input} defaultValue="5">
                                  {liveAuctionMinutes.map((m) => (
                                    <option key={m} value={m}>
                                      {m} min
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <Button type="submit" className="col-span-2 self-end sm:col-span-1">
                                Abrir leilão
                              </Button>
                            </form>
                            <p className="mt-2 text-xs text-muted">Quem está assistindo dá lances sem sair da live. Uma unidade fica reservada para o leilão.</p>
                          </details>
                        ) : (
                          isLive &&
                          p.stock > 0 &&
                          auctionRunning && (
                            <span className="flex h-11 items-center justify-center rounded-full border border-line px-4 text-center text-xs text-muted">
                              Um leilão por vez: aguarde o atual terminar
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {auctionRunning && auction && (
            <p className="border-t border-line p-4 text-sm text-navy">
              Leilão ao vivo em andamento: <Link href={`/leilao/${auction.id}`} className="font-semibold text-brand hover:underline">{auction.title}</Link>
            </p>
          )}
        </section>
        <LiveChat liveId={live.id} initial={messages} canSend={isLive} loggedIn moderator />
      </div>
    </div>
  );
}

const streamStatusLabel = {
  active: "Recebendo vídeo",
  idle: "Aguardando o sinal do OBS ou do celular",
  disabled: "Transmissão desligada",
} as const;

function ManualPlayback({ liveId, playbackUrl }: { liveId: string; playbackUrl: string | null }) {
  return (
    <form action={setPlayback} className="flex gap-2">
      <input type="hidden" name="liveId" value={liveId} />
      <input name="playbackUrl" defaultValue={playbackUrl ?? ""} aria-label="Link de reprodução HLS" placeholder="https://.../live.m3u8" className={input} />
      <Button type="submit" variant="secondary">
        Salvar
      </Button>
    </form>
  );
}

function StreamPanel({ liveId, playbackUrl, stream }: { liveId: string; playbackUrl: string | null; stream: StudioStream }) {
  return (
    <section className="space-y-3 rounded-[var(--radius-card)] border border-line bg-white p-5 text-sm" data-testid="transmissao">
      <h2 className="font-semibold text-navy">Vídeo da transmissão</h2>
      {stream.kind === "ready" && (
        <>
          <p className="text-muted">
            Status: <strong className="text-navy" data-testid="status-transmissao">{streamStatusLabel[stream.status]}</strong>. Quando o
            vídeo estiver chegando, toque em “Começar live”.
          </p>
          <dl className="grid gap-2 sm:grid-cols-[140px_1fr]">
            <dt className="font-semibold text-navy">Servidor</dt>
            <dd>
              <code className="select-all break-all rounded bg-surface px-2 py-1">{stream.serverUrl}</code>
            </dd>
            <dt className="font-semibold text-navy">Chave</dt>
            <dd>
              <details>
                <summary className="cursor-pointer text-brand">Mostrar chave de transmissão</summary>
                <code className="mt-1 block select-all break-all rounded bg-surface px-2 py-1">{stream.streamKey}</code>
                <p className="mt-1 text-xs text-muted">Não compartilhe: quem tiver a chave consegue transmitir na sua live.</p>
              </details>
            </dd>
          </dl>
          <p className="text-xs text-muted">
            OBS: Configurações → Transmissão → Serviço “Personalizado”, cole o servidor e a chave. No celular, use um app de
            transmissão RTMP (ex.: Larix Broadcaster) com os mesmos dados.
          </p>
        </>
      )}
      {stream.kind === "unreachable" && (
        <Notice tone="error">O serviço de transmissão não respondeu agora. Atualize a página em instantes.</Notice>
      )}
      {stream.kind === "none" && (
        <>
          <p className="text-muted">Gere a chave e transmita pelo OBS (computador) ou por um app de celular. Quem assiste recebe o vídeo aqui na Zexi.</p>
          <form action={openStream}>
            <input type="hidden" name="liveId" value={liveId} />
            <Button type="submit">Gerar chave de transmissão</Button>
          </form>
          <details>
            <summary className="cursor-pointer text-xs text-muted">Usar outro serviço (link HLS)</summary>
            <div className="mt-2">
              <ManualPlayback liveId={liveId} playbackUrl={playbackUrl} />
            </div>
          </details>
        </>
      )}
      {stream.kind === "unconfigured" && (
        <>
          <p className="text-muted">
            A transmissão integrada da Zexi está em configuração. Por enquanto, transmita por um serviço de vídeo e cole
            aqui o link de reprodução HLS (https, termina em .m3u8).
          </p>
          <ManualPlayback liveId={liveId} playbackUrl={playbackUrl} />
        </>
      )}
    </section>
  );
}

export default function Page({ params, searchParams }: PageProps<"/seller/lives/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
      <Studio params={params} searchParams={searchParams as Promise<SP>} />
    </Suspense>
  );
}
