import { describe, expect, it } from "vitest";
import { checkVideoFile, compactCount, MAX_VIDEO_BYTES, videoErrorMessage } from "@/lib/videos/format";

describe("vídeos", () => {
  it("aceita MP4, WebM e MOV até 50 MB", () => {
    expect(checkVideoFile({ type: "video/mp4", size: 1000 })).toBeNull();
    expect(checkVideoFile({ type: "video/webm", size: MAX_VIDEO_BYTES })).toBeNull();
    expect(checkVideoFile({ type: "video/quicktime", size: 10 })).toBeNull();
  });
  it("recusa outros tipos, arquivo vazio e acima do limite", () => {
    expect(checkVideoFile({ type: "image/png", size: 10 })).toMatch(/MP4/);
    expect(checkVideoFile({ type: "video/mp4", size: MAX_VIDEO_BYTES + 1 })).toMatch(/50 MB/);
    expect(checkVideoFile({ type: "video/mp4", size: 0 })).toMatch(/vazio/);
  });
  it("contadores compactos", () => {
    expect(compactCount(999)).toBe("999");
    expect(compactCount(1200)).toBe("1,2 mil");
    expect(compactCount(1000)).toBe("1 mil");
    expect(compactCount(25000)).toBe("25 mil");
    expect(compactCount(3_400_000)).toBe("3,4 mi");
  });
  it("erros do banco", () => {
    expect(videoErrorMessage("product_not_found")).toMatch(/produto da sua loja/);
    expect(videoErrorMessage("file_not_found")).toMatch(/envio do arquivo/);
  });
});
