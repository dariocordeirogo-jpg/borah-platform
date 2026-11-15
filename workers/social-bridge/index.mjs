// Conector TikTok → Zexi. Fica rodando num servidor (ex.: Railway), fora da Vercel.
// A cada 30 s pergunta ao banco quais lives estão no ar com @ do TikTok, conecta no chat de cada uma e
// repassa cada comentário assinado. Quem decide lance, carrinho e vínculo é o banco (social_bridge_comment).
import { TikTokLiveConnection, WebcastEvent } from "tiktok-live-connector";
import { commentPayload, rpc, targetsPayload } from "./protocol.mjs";

const env = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  SOCIAL_BRIDGE_SECRET: process.env.SOCIAL_BRIDGE_SECRET,
};
for (const [k, v] of Object.entries(env)) if (!v) throw new Error(`Falta a variável ${k}`);
if (env.SOCIAL_BRIDGE_SECRET.length < 32) throw new Error("SOCIAL_BRIDGE_SECRET precisa de 32+ caracteres");

const live = new Map(); // "liveId:username" → conexão

async function sync() {
  const targets = (await rpc(env, "social_bridge_targets", targetsPayload())).filter((t) => t.platform === "tiktok");
  const wanted = new Set(targets.map((t) => `${t.live_id}:${t.username}`));
  for (const [key, conn] of live) {
    if (!wanted.has(key)) {
      conn.disconnect();
      live.delete(key);
      console.log("desconectado", key);
    }
  }
  for (const t of targets) {
    const key = `${t.live_id}:${t.username}`;
    if (live.has(key)) continue;
    const conn = new TikTokLiveConnection(t.username, { signApiKey: process.env.EULER_API_KEY || undefined });
    live.set(key, conn);
    conn.on(WebcastEvent.CHAT, async (chat) => {
      try {
        const r = await rpc(env, "social_bridge_comment", commentPayload(t.live_id, "tiktok", chat));
        if (r?.result && r.result !== "comment") console.log(key, chat?.user?.uniqueId, r.result);
      } catch (e) {
        console.error("falha ao repassar comentário", key, e.message);
      }
    });
    const drop = () => live.delete(key); // próxima rodada tenta de novo
    conn.on(WebcastEvent.STREAM_END, drop);
    conn.on(WebcastEvent.DISCONNECTED, drop);
    conn.connect().then(
      () => console.log("conectado", key),
      (e) => {
        console.error("não conectou", key, e?.message ?? e);
        drop();
      },
    );
  }
}

async function loop() {
  try {
    await sync();
  } catch (e) {
    console.error("sync", e.message);
  }
  setTimeout(loop, 30_000);
}
void loop();
