import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CloudflareError,
  cloudflareConfigured,
  createCfInput,
  deleteCfInput,
  getCfInput,
  newInputRequest,
  playUrl,
  publishUrl,
} from "@/lib/live/cloudflare";
import { isWhepUrl } from "@/lib/live/format";
import { negotiate, WebRtcError } from "@/lib/live/webrtc";

const UID = "f256e6ea9341d51eea64c9454659e576";
const PLAY = `https://customer-abc123xyz9.cloudflarestream.com/${UID}/webRTC/play`;
const PUBLISH = "https://customer-abc123xyz9.cloudflarestream.com/71adb6d1676e2aa8d42ddce2271a2aedk5b6efd743b78487c095b2911e08345d8/webRTC/publish";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CLOUDFLARE_API_TOKEN", "token-teste");
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "conta123");
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const ok = (result: unknown) => new Response(JSON.stringify({ success: true, result }), { status: 200 });
const input = { uid: UID, webRTC: { url: PUBLISH }, webRTCPlayback: { url: PLAY } };

describe("Cloudflare Stream (transmissão pelo navegador)", () => {
  it("só fica ativo com token e conta", () => {
    expect(cloudflareConfigured()).toBe(true);
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    expect(cloudflareConfigured()).toBe(false);
  });

  it("cria a entrada sem gravação, marcada com a live, com o token como Bearer", async () => {
    fetchMock.mockResolvedValue(ok(input));
    expect((await createCfInput("live-1")).uid).toBe(UID);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/conta123/stream/live_inputs");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-teste");
    expect(JSON.parse(init.body)).toEqual(newInputRequest("live-1"));
    expect(newInputRequest("live-1")).toMatchObject({ recording: { mode: "off" }, meta: { liveId: "live-1" } });
  });

  it("consulta e apaga pela id da entrada (resposta vazia no apagar não quebra)", async () => {
    fetchMock.mockResolvedValueOnce(ok(input));
    await getCfInput(UID);
    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.cloudflare.com/client/v4/accounts/conta123/stream/live_inputs/${UID}`);
    fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));
    await deleteCfInput(UID);
    expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
  });

  it("erro da Cloudflare vira CloudflareError com o status, sem vazar o corpo", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"success":false,"errors":[{"code":10000}]}', { status: 403 }));
    await expect(getCfInput(UID)).rejects.toEqual(new CloudflareError(403));
    fetchMock.mockResolvedValueOnce(new Response('{"success":false}', { status: 200 }));
    await expect(getCfInput(UID)).rejects.toEqual(new CloudflareError(502));
  });

  it("aceita só endereços da Cloudflare no formato esperado", () => {
    expect(playUrl(input)).toBe(PLAY);
    expect(publishUrl(input)).toBe(PUBLISH);
    expect(playUrl({ ...input, uid: "a".repeat(32) })).toBeNull(); // reprodução de outra entrada
    expect(playUrl({ uid: UID, webRTCPlayback: { url: `https://evil.example.com/${UID}/webRTC/play` } })).toBeNull();
    expect(publishUrl({ uid: UID, webRTC: { url: "http://customer-abc123xyz9.cloudflarestream.com/x/webRTC/publish" } })).toBeNull();
    expect(publishUrl({ uid: UID })).toBeNull();
  });

  it("player reconhece o link WHEP e não confunde com o de envio", () => {
    expect(isWhepUrl(PLAY)).toBe(true);
    expect(isWhepUrl(PUBLISH)).toBe(false);
    expect(isWhepUrl("https://stream.mux.com/abc1234567.m3u8")).toBe(false);
    expect(isWhepUrl(null)).toBe(false);
  });
});

describe("WHIP/WHEP: troca de SDP", () => {
  function fakePc() {
    return {
      iceGatheringState: "complete",
      localDescription: { sdp: "v=0 oferta" } as RTCSessionDescription,
      createOffer: vi.fn(async () => ({ type: "offer", sdp: "v=0 oferta" })),
      setLocalDescription: vi.fn(async () => undefined),
      setRemoteDescription: vi.fn(async () => undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as RTCPeerConnection;
  }

  it("manda a oferta como application/sdp e aplica a resposta; devolve a sessão para encerrar", async () => {
    const pc = fakePc();
    const fetcher = vi.fn(async () => new Response("v=0 resposta", { status: 201, headers: { Location: "/sessao/123" } }));
    const resource = await negotiate(pc, PUBLISH, fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledWith(PUBLISH, { method: "POST", headers: { "Content-Type": "application/sdp" }, body: "v=0 oferta" });
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({ type: "answer", sdp: "v=0 resposta" });
    expect(resource).toBe("https://customer-abc123xyz9.cloudflarestream.com/sessao/123");
  });

  it("recusa da Cloudflare (sem ninguém transmitindo) vira erro e não aplica nada", async () => {
    const pc = fakePc();
    const fetcher = vi.fn(async () => new Response("", { status: 409 }));
    await expect(negotiate(pc, PLAY, fetcher as unknown as typeof fetch)).rejects.toEqual(new WebRtcError(409));
    expect(pc.setRemoteDescription).not.toHaveBeenCalled();
  });
});
