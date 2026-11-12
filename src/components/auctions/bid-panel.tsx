"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Gavel, Loader2, ShieldCheck, Trophy, Users } from "lucide-react";
import { AuctionTimer } from "@/components/auctions/auction-timer";
import { Button } from "@/components/ui/button";
import { placeBid } from "@/lib/auctions/actions";
import { formatBRL } from "@/lib/format";
import { parseBRLToCents } from "@/lib/market/format";
import { getBrowserClient } from "@/lib/supabase/client";

type Bid = { id: number; bidder_alias: string; amount_cents: number; created_at: string };
type Live = {
  current: number | null;
  endsAt: string;
  bidsCount: number;
  leaderAlias: string | null;
  status: "active" | "ended" | "cancelled";
};

export type BidPanelProps = {
  auctionId: string;
  serverNow: string;
  startsAt: string;
  startingCents: number;
  incrementCents: number;
  initial: Live;
  bids: Bid[];
  me: { loggedIn: boolean; isSeller: boolean; isLeader: boolean; blocker: string | null };
  reserveCents: number | null;
};

function blockerCta(blocker: string, auctionId: string) {
  if (blocker === "not_authenticated")
    return { text: "Entre na sua conta para dar lances.", href: `/entrar?next=/leilao/${auctionId}`, cta: "Entrar" };
  if (blocker === "verification_required" || blocker === "phone_unverified")
    return {
      text: "Para dar lances, confirme seu CPF e telefone. Leva menos de 1 minuto.",
      href: `/conta/verificacao?next=/leilao/${auctionId}`,
      cta: "Confirmar CPF e telefone",
    };
  if (blocker === "bid_blocked")
    return { text: "Sua conta está temporariamente impedida de dar lances por arremates não confirmados.", href: "/conta/lances", cta: "Ver meus lances" };
  return { text: "Você não pode mais dar lances neste lote porque não confirmou um arremate anterior dele.", href: "/leiloes", cta: "Ver outros leilões" };
}

export function BidPanel(props: BidPanelProps) {
  const { auctionId, incrementCents, startingCents } = props;
  const [live, setLive] = useState<Live>(props.initial);
  const [bids, setBids] = useState<Bid[]>(props.bids);
  const [isLeader, setIsLeader] = useState(props.me.isLeader);
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const myLastBid = useRef<number | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [opened, setOpened] = useState(false);
  const markEnded = useCallback(() => setTimeUp(true), []);
  const markOpened = useCallback(() => setOpened(true), []);

  const minCents = live.current === null ? startingCents : live.current + incrementCents;
  const startedAtLoad = useMemo(
    () => new Date(props.startsAt).getTime() <= new Date(props.serverNow).getTime(),
    [props.startsAt, props.serverNow],
  );
  const started = startedAtLoad || opened;

  // Tempo real: novos lances e mudanças no leilão (preço, fim estendido, encerramento)
  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`auction-${auctionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auctions", filter: `id=eq.${auctionId}` },
        (payload) => {
          const a = payload.new as { current_price_cents: number | null; ends_at: string; bids_count: number; leader_alias: string | null; status: Live["status"] };
          setLive({ current: a.current_price_cents, endsAt: a.ends_at, bidsCount: a.bids_count, leaderAlias: a.leader_alias, status: a.status });
          if (myLastBid.current !== null && a.current_price_cents !== myLastBid.current) setIsLeader(false);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "auction_bids", filter: `auction_id=eq.${auctionId}` },
        (payload) => {
          const b = payload.new as Bid;
          setBids((prev) => (prev.some((x) => x.id === b.id) ? prev : [b, ...prev].slice(0, 30)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [auctionId]);

  function submit(cents: number) {
    setMsg(null);
    start(async () => {
      const key = crypto.randomUUID();
      const r = await placeBid(auctionId, cents, key);
      if (r.ok) {
        myLastBid.current = r.currentCents;
        setIsLeader(true);
        setLive((l) => ({ ...l, current: r.currentCents, endsAt: r.endsAt, bidsCount: l.bidsCount + (l.current === r.currentCents ? 0 : 1) }));
        setAmount("");
        setMsg({
          tone: "ok",
          text: r.extended
            ? `Lance de ${formatBRL(r.currentCents)} registrado. O prazo foi estendido em 2 minutos.`
            : `Lance de ${formatBRL(r.currentCents)} registrado. Você está ganhando!`,
        });
      } else {
        setMsg({ tone: "err", text: r.error });
      }
    });
  }

  const typed = amount ? parseBRLToCents(amount) : null;
  const ended = live.status !== "active" || timeUp;

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-2">
              {live.current === null ? "Lance inicial" : "Maior lance"}
            </p>
            <p className="text-4xl font-extrabold tracking-tight text-navy" aria-live="polite" data-testid="maior-lance">
              {formatBRL(live.current ?? startingCents)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted">
              <Users className="h-4 w-4" aria-hidden="true" /> {live.bidsCount} {live.bidsCount === 1 ? "lance" : "lances"}
              {live.leaderAlias && <> · liderando: <span className="font-semibold text-navy">{live.leaderAlias}</span></>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">{started ? "Termina em" : "Abre em"}</p>
            <AuctionTimer
              target={started ? live.endsAt : props.startsAt}
              serverNow={props.serverNow}
              className="text-2xl font-bold text-navy"
              endedLabel={started ? "Encerrado" : "Abrindo…"}
              onEnd={started ? markEnded : markOpened}
            />
          </div>
        </div>
        {props.reserveCents !== null && (
          <p className="mt-2 text-xs text-muted">
            Este leilão tem preço de reserva: só há vencedor se o maior lance atingir o valor definido pela loja.
          </p>
        )}

        <div className="mt-4 border-t border-line pt-4">
          {ended ? (
            <p className="text-sm font-semibold text-navy">Leilão encerrado. O resultado aparece em instantes.</p>
          ) : props.me.isSeller ? (
            <p className="text-sm text-muted">Este leilão é da sua loja. Acompanhe os lances em tempo real.</p>
          ) : props.me.blocker ? (
            (() => {
              const c = blockerCta(props.me.blocker, auctionId);
              return (
                <div className="space-y-3">
                  <p className="text-sm text-ink">{c.text}</p>
                  <Link href={c.href} className="inline-flex h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark">
                    {c.cta}
                  </Link>
                </div>
              );
            })()
          ) : !started ? (
            <p className="text-sm text-muted">Os lances abrem quando o cronômetro zerar.</p>
          ) : isLeader ? (
            <p className="flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm font-semibold text-success">
              <Trophy className="h-5 w-5" aria-hidden="true" /> Você tem o maior lance. Aguarde ou acompanhe as disputas.
            </p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const cents = typed ?? minCents;
                submit(cents);
              }}
            >
              <label htmlFor="valor-lance" className="block text-sm font-medium text-navy">
                Seu lance (mínimo {formatBRL(minCents)})
              </label>
              <div className="flex gap-2">
                <input
                  id="valor-lance"
                  inputMode="decimal"
                  placeholder={(minCents / 100).toFixed(2).replace(".", ",")}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-lg outline-none focus:border-navy-2 focus:ring-2 focus:ring-navy-2/20"
                />
              </div>
              <Button type="submit" variant="buy" size="lg" className="w-full" disabled={pending || (amount !== "" && typed === null)}>
                {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Gavel className="h-5 w-5" aria-hidden="true" />}
                Dar lance · {formatBRL(typed && typed >= minCents ? typed : minCents)}
              </Button>
              <p className="text-xs text-muted">Ao dar um lance você se compromete a comprar caso vença. O lance não pode ser desfeito.</p>
            </form>
          )}
          {msg && (
            <p role={msg.tone === "err" ? "alert" : "status"} className={`mt-3 rounded-xl px-4 py-3 text-sm ${msg.tone === "err" ? "bg-red-50 text-danger" : "bg-success-soft text-success"}`}>
              {msg.text}
            </p>
          )}
        </div>
      </div>

      <section className="rounded-[var(--radius-card)] border border-line bg-white p-5">
        <h2 className="font-display text-lg font-bold text-navy">Histórico de lances</h2>
        {bids.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nenhum lance ainda. Seja o primeiro!</p>
        ) : (
          <ol className="mt-3 divide-y divide-line text-sm" aria-label="Lances, do mais recente ao mais antigo">
            {bids.map((b, i) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <span className={i === 0 ? "font-semibold text-navy" : "text-ink"}>
                  {b.bidder_alias} {i === 0 && <span className="ml-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-dark">maior</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-muted">{new Date(b.created_at).toLocaleTimeString("pt-BR")}</span>
                  <span className="font-semibold text-navy">{formatBRL(b.amount_cents)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="flex items-start gap-2 text-xs text-muted">
        <ShieldCheck className="h-4 w-4 shrink-0 text-navy-2" aria-hidden="true" />
        <span>
          Cada lance é validado pelo servidor da Zexi: valor mínimo, horário oficial e prorrogação automática de 2 minutos
          quando um lance chega nos últimos 2 minutos.{" "}
          <Link href="/leiloes/regras" className="whitespace-nowrap text-brand underline">
            Regras dos leilões
          </Link>
        </span>
      </p>
    </div>
  );
}
