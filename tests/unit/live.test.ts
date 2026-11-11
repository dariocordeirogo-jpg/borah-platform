import { describe, expect, it } from "vitest";
import { isPlaybackUrl, liveErrorMessage } from "@/lib/live/format";

describe("live", () => {
  it.each([
    ["https://stream.mux.com/abc123.m3u8", true],
    ["https://exemplo.com/live/index.m3u8?token=x", true],
    ["http://exemplo.com/live.m3u8", false],
    ["https://exemplo.com/video.mp4", false],
    ["javascript:alert(1)//.m3u8", false],
    ["nao é url", false],
    [`https://x.com/${"a".repeat(500)}.m3u8`, false],
  ])("link de reprodução %s → %s", (url, ok) => expect(isPlaybackUrl(url)).toBe(ok));

  it("erros do banco", () => {
    expect(liveErrorMessage("too_fast")).toMatch(/Espere/);
    expect(liveErrorMessage("live_auction_running")).toMatch(/leilão relâmpago/);
    expect(liveErrorMessage()).toMatch(/Tente de novo/);
  });
});
