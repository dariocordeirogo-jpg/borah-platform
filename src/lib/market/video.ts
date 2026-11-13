/**
 * Vídeo do produto por link (YouTube, Instagram ou Facebook).
 * O banco guarda o link que a loja colou; o player é montado a partir do ID extraído aqui, nunca do link bruto,
 * então só endereços oficiais de incorporação chegam ao navegador.
 */

export type ProductVideo = {
  provider: "youtube" | "instagram" | "facebook";
  /** URL do player embutido (iframe) */
  embedUrl: string;
  /** Formato do player: YouTube deitado; Instagram/Facebook (reels) em pé */
  orientation: "landscape" | "portrait";
  /** Link para abrir no site de origem */
  watchUrl: string;
};

export const VIDEO_URL_MAX = 500;

function url(raw: string): URL | null {
  const s = raw.trim();
  if (!s || s.length > VIDEO_URL_MAX) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

const host = (u: URL) => u.hostname.toLowerCase().replace(/^(www|m|mobile|web)\./, "");

function youtube(u: URL): ProductVideo | null {
  const h = host(u);
  let id: string | null = null;
  if (h === "youtu.be") id = u.pathname.split("/")[1] ?? null;
  else if (h === "youtube.com" || h === "music.youtube.com" || h === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
      id = m?.[1] ?? null;
    }
  } else return null;
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  const short = /^\/shorts\//.test(u.pathname);
  return {
    provider: "youtube",
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`,
    orientation: short ? "portrait" : "landscape",
    watchUrl: short ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
  };
}

function instagram(u: URL): ProductVideo | null {
  if (host(u) !== "instagram.com") return null;
  const m = u.pathname.match(/^\/(?:[A-Za-z0-9._]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})/);
  if (!m) return null;
  const kind = m[1] === "reels" ? "reel" : m[1];
  return {
    provider: "instagram",
    embedUrl: `https://www.instagram.com/${kind}/${m[2]}/embed/`,
    orientation: "portrait",
    watchUrl: `https://www.instagram.com/${kind}/${m[2]}/`,
  };
}

function facebook(u: URL): ProductVideo | null {
  const h = host(u);
  if (h !== "facebook.com" && h !== "fb.watch") return null;
  let canonical: string | null = null;
  if (h === "fb.watch") {
    const code = u.pathname.split("/")[1];
    if (code && /^[A-Za-z0-9_-]{3,40}$/.test(code)) canonical = `https://fb.watch/${code}/`;
  } else if (u.pathname.startsWith("/watch")) {
    const v = u.searchParams.get("v");
    if (v && /^\d{5,25}$/.test(v)) canonical = `https://www.facebook.com/watch/?v=${v}`;
  } else {
    const m =
      u.pathname.match(/^\/([A-Za-z0-9.]{1,80})\/videos\/(?:[^/]+\/)?(\d{5,25})/) ??
      u.pathname.match(/^\/(reel)\/(\d{5,25})/) ??
      u.pathname.match(/^\/(share)\/[vr]\/([A-Za-z0-9_-]{5,40})/);
    if (m) {
      canonical =
        m[1] === "reel"
          ? `https://www.facebook.com/reel/${m[2]}`
          : m[1] === "share"
            ? `https://www.facebook.com${u.pathname.replace(/\/+$/, "")}/`
            : `https://www.facebook.com/${m[1]}/videos/${m[2]}/`;
    }
  }
  if (!canonical) return null;
  const reel = /\/reel\/|fb\.watch|\/share\/r\//.test(canonical);
  return {
    provider: "facebook",
    embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(canonical)}&show_text=false&width=560`,
    orientation: reel ? "portrait" : "landscape",
    watchUrl: canonical,
  };
}

/** Converte o link colado pela loja no player oficial. Devolve null para qualquer outro site. */
export function parseVideoUrl(raw: string | null | undefined): ProductVideo | null {
  if (!raw) return null;
  const u = url(raw);
  if (!u) return null;
  return youtube(u) ?? instagram(u) ?? facebook(u);
}

export const videoProviderName: Record<ProductVideo["provider"], string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
};
