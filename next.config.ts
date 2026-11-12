import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    // Fotos de produto têm até 5 MB (limite do bucket); folga para os outros campos do formulário.
    serverActions: { bodySizeLimit: "6mb" },
  },
  images: {
    // NEXT_IMAGE_UNOPTIMIZED=1 serve as fotos direto do Supabase (útil em máquinas atrás de proxy, como nos testes).
    unoptimized: process.env.NEXT_IMAGE_UNOPTIMIZED === "1",
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      // Endereço antigo do módulo de leilões
      { source: "/lances", destination: "/leiloes", permanent: true },
      // Busca do cabeçalho → catálogo do Market (a query ?q= é repassada)
      { source: "/busca", destination: "/market", permanent: false },
      // zexi.com.br → www.zexi.com.br é feito pela Vercel (Settings → Domains), não aqui:
      // os dois redirecionamentos juntos criam um loop.
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Navegador só usa HTTPS no domínio (tem efeito em produção, onde o site é servido por HTTPS)
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
