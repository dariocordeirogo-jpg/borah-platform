import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createMuxStream, disableMuxStream, getMuxStream, MuxError, muxConfigured, newStreamRequest, publicPlaybackId } from "@/lib/live/mux";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("MUX_TOKEN_ID", "token-id");
  vi.stubEnv("MUX_TOKEN_SECRET", "token-secret");
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const ok = (data: unknown) => new Response(JSON.stringify({ data }), { status: 201, headers: { "Content-Type": "application/json" } });

describe("Mux (transmissão das lives)", () => {
  it("só fica ativo com token id e secret", () => {
    expect(muxConfigured()).toBe(true);
    vi.stubEnv("MUX_TOKEN_SECRET", "");
    expect(muxConfigured()).toBe(false);
  });

  it("cria a transmissão pública, de baixa latência e sem gravação, marcada com a live", async () => {
    fetchMock.mockResolvedValue(ok({ id: "Stream123456", stream_key: "chave", status: "idle", playback_ids: [{ id: "Play1234567", policy: "public" }] }));
    const s = await createMuxStream("live-1");
    expect(s.id).toBe("Stream123456");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.mux.com/video/v1/live-streams");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("token-id:token-secret").toString("base64")}`);
    const body = JSON.parse(init.body);
    expect(body).toEqual(newStreamRequest("live-1"));
    expect(body).toMatchObject({ playback_policy: ["public"], latency_mode: "low", passthrough: "live-1" });
    expect(body).not.toHaveProperty("new_asset_settings");
  });

  it("consulta e desliga pela id da transmissão", async () => {
    fetchMock.mockResolvedValueOnce(ok({ id: "S", stream_key: "k", status: "active" }));
    expect((await getMuxStream("Stream123456")).status).toBe("active");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.mux.com/video/v1/live-streams/Stream123456");
    fetchMock.mockResolvedValueOnce(ok({}));
    await disableMuxStream("Stream123456");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.mux.com/video/v1/live-streams/Stream123456/disable");
    expect(fetchMock.mock.calls[1][1].method).toBe("PUT");
  });

  it("erro do Mux vira MuxError com o status, sem vazar o corpo", async () => {
    fetchMock.mockResolvedValue(new Response('{"error":{"messages":["x"]}}', { status: 401 }));
    await expect(getMuxStream("Stream123456")).rejects.toEqual(new MuxError(401));
  });

  it("usa só a reprodução pública", () => {
    expect(publicPlaybackId({ playback_ids: [{ id: "a", policy: "signed" }, { id: "b", policy: "public" }] })).toBe("b");
    expect(publicPlaybackId({ playback_ids: [{ id: "a", policy: "signed" }] })).toBeNull();
    expect(publicPlaybackId({})).toBeNull();
  });
});
