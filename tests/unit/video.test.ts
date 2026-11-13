import { describe, expect, it } from "vitest";
import { parseVideoUrl } from "@/lib/market/video";

describe("vídeo do produto por link", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s", "dQw4w9WgXcQ", "landscape"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ", "landscape"],
    ["youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ", "portrait"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ", "landscape"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ", "landscape"],
  ])("YouTube %s", (link, id, orientation) => {
    const v = parseVideoUrl(link)!;
    expect(v.provider).toBe("youtube");
    expect(v.embedUrl).toBe(`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`);
    expect(v.orientation).toBe(orientation);
  });

  it.each([
    ["https://www.instagram.com/reel/C9xYz123AbC/?igsh=xyz", "https://www.instagram.com/reel/C9xYz123AbC/embed/"],
    ["https://instagram.com/p/C9xYz123AbC/", "https://www.instagram.com/p/C9xYz123AbC/embed/"],
    ["https://www.instagram.com/lojaexemplo/reel/C9xYz123AbC/", "https://www.instagram.com/reel/C9xYz123AbC/embed/"],
    ["https://www.instagram.com/reels/C9xYz123AbC/", "https://www.instagram.com/reel/C9xYz123AbC/embed/"],
  ])("Instagram %s", (link, embed) => {
    expect(parseVideoUrl(link)).toMatchObject({ provider: "instagram", embedUrl: embed, orientation: "portrait" });
  });

  it.each([
    ["https://www.facebook.com/lojaexemplo/videos/1234567890123/", "https://www.facebook.com/lojaexemplo/videos/1234567890123/", "landscape"],
    ["https://www.facebook.com/watch/?v=1234567890123", "https://www.facebook.com/watch/?v=1234567890123", "landscape"],
    ["https://m.facebook.com/reel/1234567890123", "https://www.facebook.com/reel/1234567890123", "portrait"],
    ["https://fb.watch/aBcD12_x/", "https://fb.watch/aBcD12_x/", "portrait"],
  ])("Facebook %s", (link, canonical, orientation) => {
    const v = parseVideoUrl(link)!;
    expect(v.provider).toBe("facebook");
    expect(v.embedUrl).toBe(`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(canonical)}&show_text=false&width=560`);
    expect(v.orientation).toBe(orientation);
  });

  it.each([
    "",
    "https://vimeo.com/123",
    "https://youtube.com.golpe.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=curto",
    "javascript:alert(1)",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ\"><script>",
    "https://www.instagram.com/lojaexemplo/",
    "https://www.facebook.com/lojaexemplo",
    `https://www.youtube.com/watch?v=dQw4w9WgXcQ&x=${"a".repeat(600)}`,
  ])("recusa %s", (link) => expect(parseVideoUrl(link)).toBeNull());
});
