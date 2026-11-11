"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { EyeOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hideMessage, sendMessage } from "@/lib/live/actions";
import { getBrowserClient } from "@/lib/supabase/client";

export type ChatMessage = { id: number; alias: string; body: string; hidden: boolean };

/** Chat em tempo real (Supabase Realtime). A loja pode esconder mensagens (moderar). */
export function LiveChat({
  liveId,
  initial,
  canSend,
  loggedIn,
  moderator = false,
}: {
  liveId: string;
  initial: ChatMessage[];
  canSend: boolean;
  loggedIn: boolean;
  moderator?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [connected, setConnected] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof getBrowserClient>["channel"]> | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`live-chat-${liveId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_messages", filter: `live_id=eq.${liveId}` }, (p) => {
        const m = p.new as ChatMessage;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev.slice(-99), m]));
      })
      // Mensagem escondida deixa de ser visível pelo RLS, então o aviso chega por broadcast (só visual;
      // o banco já não entrega a mensagem para quem carregar a página).
      .on("broadcast", { event: "hide" }, ({ payload }) => {
        const id = Number((payload as { id?: number }).id);
        setMessages((prev) => (moderator ? prev.map((x) => (x.id === id ? { ...x, hidden: true } : x)) : prev.filter((x) => x.id !== id)));
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [liveId, moderator]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const visible = moderator ? messages : messages.filter((m) => !m.hidden);

  return (
    <section aria-label="Chat da live" data-realtime={connected ? "on" : "off"} className="flex h-[420px] flex-col rounded-[var(--radius-card)] border border-line bg-white">
      <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-navy">Chat</h2>
      <ol ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm" data-testid="chat-mensagens">
        {!visible.length && <li className="text-muted">Nenhuma mensagem ainda.</li>}
        {visible.map((m) => (
          <li key={m.id} className={m.hidden ? "text-muted line-through" : undefined}>
            <span className="font-semibold text-navy">{m.alias}</span> <span className="text-ink">{m.body}</span>
            {moderator && !m.hidden && (
              <button
                type="button"
                className="ml-2 inline-flex items-center gap-1 text-xs text-muted hover:text-brand"
                onClick={() =>
                  start(async () => {
                    const res = await hideMessage(m.id);
                    if (res.error) return setError(res.error);
                    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, hidden: true } : x)));
                    void channelRef.current?.send({ type: "broadcast", event: "hide", payload: { id: m.id } });
                  })
                }
              >
                <EyeOff className="h-3 w-3" aria-hidden="true" /> Esconder
              </button>
            )}
          </li>
        ))}
      </ol>
      <div className="border-t border-line p-3">
        {!canSend ? (
          <p className="text-xs text-muted">O chat abre quando a live estiver no ar.</p>
        ) : !loggedIn ? (
          <Link href={`/entrar?next=/live/${liveId}`} className="text-sm font-semibold text-brand hover:underline">
            Entre para participar do chat
          </Link>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const body = text.trim();
              if (!body) return;
              start(async () => {
                const res = await sendMessage(liveId, body);
                if (res.error) setError(res.error);
                else {
                  setError(null);
                  setText("");
                  // Mostra a própria mensagem na hora; o tempo real só confirma (sem duplicar pelo id)
                  const id = res.id;
                  if (id) setMessages((prev) => (prev.some((x) => x.id === id) ? prev : [...prev, { id, alias: "Você", body, hidden: false }]));
                }
              });
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={200}
              placeholder="Escreva no chat"
              aria-label="Mensagem para o chat"
              className="h-10 min-w-0 flex-1 rounded-full border border-line px-4 text-sm"
            />
            <Button type="submit" size="icon" disabled={pending} aria-label="Enviar mensagem">
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
