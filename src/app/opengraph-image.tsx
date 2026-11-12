import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = site.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const icon = await readFile(join(process.cwd(), "public/brand/icon-512.png"));
  const iconSrc = `data:image/png;base64,${icon.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0F1115 0%, #1F232B 100%)",
          color: "#FFFFFF",
          fontFamily: "sans-serif",
          borderBottom: "14px solid #FF4D2D",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <img src={iconSrc} width={150} height={150} alt="" />
          <div style={{ display: "flex", alignItems: "flex-start", fontSize: 120, fontWeight: 800, letterSpacing: -4 }}>
            <span>zexi</span>
            <span style={{ width: 26, height: 26, marginTop: 18, marginLeft: 6, borderRadius: 13, background: "#FF4D2D" }} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 80, fontWeight: 800, letterSpacing: -2 }}>{site.slogan}</div>
          <div style={{ fontSize: 34, marginTop: 16, color: "#C9CDD4" }}>Marketplace · Vendas ao vivo · Leilões online</div>
        </div>
      </div>
    ),
    size,
  );
}
