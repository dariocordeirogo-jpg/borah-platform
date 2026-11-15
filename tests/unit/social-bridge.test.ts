import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { commentPayload, rpc, sign, targetsPayload } from "../../workers/social-bridge/protocol.mjs";
import { isSocialPlatform, normalizeHandle, socialResultLabel } from "@/lib/social/format";

describe("Ponte TikTok/Instagram: protocolo do conector", () => {
  it("assina com HMAC-SHA256 em hex (o mesmo cálculo do banco)", () => {
    const p = targetsPayload(1_700_000_000_000);
    expect(JSON.parse(p)).toEqual({ kind: "targets", ts: 1_700_000_000_000 });
    expect(sign(p, "s".repeat(32))).toBe(createHmac("sha256", "s".repeat(32)).update(p).digest("hex"));
  });

  it("monta o comentário com o @, o apelido e o id da mensagem do TikTok", () => {
    const chat = { user: { uniqueId: "Ana_TT", nickname: "Ana" }, comment: "LANCE 150", common: { msgId: "7312345" } };
    expect(JSON.parse(commentPayload("live-1", "tiktok", chat, 5))).toEqual({
      kind: "comment", platform: "tiktok", live_id: "live-1", msg_id: "7312345", username: "Ana_TT", nickname: "Ana", text: "LANCE 150", ts: 5,
    });
  });

  it("sem id da mensagem usa um id estável (repetição não vira dois lances)", () => {
    const chat = { user: { uniqueId: "ana" }, comment: "LANCE 150", common: { createTime: "99" } };
    const a = JSON.parse(commentPayload("l", "tiktok", chat, 1)).msg_id;
    const b = JSON.parse(commentPayload("l", "tiktok", chat, 2)).msg_id;
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{32}$/);
  });

  it("chama a função do banco pela API pública com a assinatura", async () => {
    const fetcher = vi.fn(async () => new Response("[]", { status: 200 }));
    const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_PUBLISHABLE_KEY: "pub", SOCIAL_BRIDGE_SECRET: "k".repeat(32) };
    await rpc(env, "social_bridge_targets", '{"ts":1}', fetcher);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://x.supabase.co/rest/v1/rpc/social_bridge_targets");
    expect((init.headers as Record<string, string>).apikey).toBe("pub");
    expect(JSON.parse(init.body as string)).toEqual({ _payload: '{"ts":1}', _signature: sign('{"ts":1}', "k".repeat(32)) });
    fetcher.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    await expect(rpc(env, "social_bridge_targets", "{}", fetcher)).rejects.toThrow("401");
  });
});

describe("Ponte TikTok/Instagram: textos do site", () => {
  it("normaliza o @ da loja", () => {
    expect(normalizeHandle(" @Loja.Oficial ")).toBe("loja.oficial");
    expect(normalizeHandle("")).toBeNull();
    expect(normalizeHandle("loja oficial")).toBeUndefined();
    expect(normalizeHandle("a".repeat(31))).toBeUndefined();
  });
  it("só aceita as duas redes", () => {
    expect(isSocialPlatform("tiktok")).toBe(true);
    expect(isSocialPlatform("instagram")).toBe(true);
    expect(isSocialPlatform("orkut")).toBe(false);
  });
  it("explica o resultado de cada comando", () => {
    expect(socialResultLabel.not_linked).toContain("/conta/redes");
    expect(socialResultLabel.in_cart).toBe("foi para o carrinho");
  });
});
