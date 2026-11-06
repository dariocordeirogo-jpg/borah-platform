import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = site.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
          background: "linear-gradient(135deg, #1fa35a 0%, #168447 45%, #0d3b24 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="96" height="96" viewBox="0 0 48 48">
            <rect width="48" height="48" rx="12" fill="#ffffff" fillOpacity="0.15" />
            <path d="M10 12v24c0 1.6 1.7 2.5 3 1.7l15.5-10.3c1.1-.8 1.1-2.6 0-3.4L13 10.3c-1.3-.8-3 .1-3 1.7Z" fill="#fff" />
            <path d="M37.5 20.5l7 6h-4.3V40h-5.4V26.5h-4.3z" fill="#EBCB72" />
            <circle cx="40" cy="9" r="3.4" fill="#E5484D" stroke="#fff" strokeWidth="1.4" />
          </svg>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800, letterSpacing: -2 }}>
            <span>LIVE</span>
            <span style={{ color: "#EBCB72" }}>LANCE</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2 }}>{site.slogan}</div>
          <div style={{ fontSize: 34, marginTop: 16, opacity: 0.9 }}>Marketplace · Vendas ao vivo · Leilões online</div>
        </div>
      </div>
    ),
    size,
  );
}
