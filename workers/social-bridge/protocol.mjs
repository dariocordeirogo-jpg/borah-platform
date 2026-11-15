// Protocolo do conector com o banco da Zexi (sem dependências: testado em tests/unit/social-bridge.test.ts).
// Cada chamada leva um payload JSON com "ts" (ms) assinado com HMAC-SHA256 do segredo social_bridge_secret.
import { createHash, createHmac } from "node:crypto";

export function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

export function targetsPayload(now = Date.now()) {
  return JSON.stringify({ kind: "targets", ts: now });
}

/** Comentário do chat do TikTok → payload do banco. Sem id da mensagem, usa um hash estável do conteúdo. */
export function commentPayload(liveId, platform, chat, now = Date.now()) {
  const username = String(chat?.user?.uniqueId ?? chat?.uniqueId ?? "");
  const nickname = String(chat?.user?.nickname ?? chat?.nickname ?? username);
  const text = String(chat?.comment ?? "").slice(0, 200);
  const rawId = chat?.common?.msgId ?? chat?.msgId;
  const msgId = rawId != null && String(rawId) !== "0"
    ? String(rawId)
    : createHash("sha256").update(`${username}|${text}|${chat?.common?.createTime ?? ""}`).digest("hex").slice(0, 32);
  return JSON.stringify({ kind: "comment", platform, live_id: liveId, msg_id: msgId, username, nickname, text, ts: now });
}

/** Chama uma função do banco (Supabase REST) com o payload assinado. */
export async function rpc(env, name, payload, fetcher = fetch) {
  const res = await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ _payload: payload, _signature: sign(payload, env.SOCIAL_BRIDGE_SECRET) }),
  });
  if (!res.ok) throw new Error(`rpc ${name}: ${res.status}`);
  return res.json();
}
