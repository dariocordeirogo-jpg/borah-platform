import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

vi.mock("server-only", () => ({}));
const rpc = vi.fn();
vi.mock("@/lib/supabase/anon", () => ({ createAnonClient: () => ({ rpc }) }));
const disableMuxStream = vi.fn();
vi.mock("@/lib/live/mux", () => ({ disableMuxStream: (id: string) => disableMuxStream(id), muxConfigured: () => true }));

import { POST } from "@/app/api/webhooks/mux/route";
import { followUpMux } from "@/lib/live/mux-webhook";

beforeEach(() => {
  vi.stubEnv("MUX_WEBHOOK_SECRET", "segredo-do-webhook-mux-123456");
  rpc.mockReset();
  disableMuxStream.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

const req = (body: string, sig?: string) =>
  new Request("https://www.zexi.com.br/api/webhooks/mux", { method: "POST", body, headers: sig ? { "mux-signature": sig } : {} });

describe("Webhook do Mux", () => {
  it("sem assinatura nem chega ao banco", async () => {
    const res = await POST(req("{}"));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("repassa o corpo cru e a assinatura para o banco decidir", async () => {
    rpc.mockResolvedValue({ data: { result: "signal_active" }, error: null });
    const body = '{"id":"ev1","type":"video.live_stream.active","data":{"id":"Stream123456"}}';
    const res = await POST(req(body, "t=1,v1=abc"));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("mux_ingest_event", { _payload: body, _signature: "t=1,v1=abc" });
  });

  it("assinatura recusada pelo banco vira 400; erro nosso vira 500 (o Mux tenta de novo)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "invalid_signature" } });
    expect((await POST(req("{}", "t=1,v1=x"))).status).toBe(400);
    rpc.mockResolvedValueOnce({ data: null, error: { message: "webhook_not_configured" } });
    expect((await POST(req("{}", "t=1,v1=x"))).status).toBe(500);
  });

  it("live que saiu do ar: desliga a chave no Mux e avisa o banco com aviso assinado", async () => {
    rpc.mockResolvedValue({ data: { result: "marked_disabled" }, error: null });
    await followUpMux({ result: "live_finished", action: "disable", stream_id: "Stream123456" });
    expect(disableMuxStream).toHaveBeenCalledWith("Stream123456");
    const [, args] = rpc.mock.calls[0];
    const payload = JSON.parse(args._payload);
    expect(payload).toMatchObject({ type: "zexi.stream_disabled", data: { id: "Stream123456" } });
    const [t, v1] = args._signature.split(",").map((p: string) => p.split("=")[1]);
    expect(v1).toBe(createHmac("sha256", "segredo-do-webhook-mux-123456").update(`${t}.${args._payload}`).digest("hex"));
  });

  it("não desliga nada sem pedido do banco ou com id estranho", async () => {
    await followUpMux({ result: "signal_idle" });
    await followUpMux({ action: "disable", stream_id: "../x" });
    expect(disableMuxStream).not.toHaveBeenCalled();
  });
});
