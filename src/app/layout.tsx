import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { BottomNav } from "@/components/bottom-nav";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { JsonLd } from "@/components/seo/json-ld";
import { site } from "@/lib/site";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.title,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: ["marketplace", "leilão online", "vendas ao vivo", "live commerce", "comprar online", "vender online", "Zexi"],
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: site.name,
    title: site.title,
    description: site.description,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: site.title, description: site.description },
  appleWebApp: { title: site.name, capable: true, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${sora.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Pular para o conteúdo
        </a>
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@graph": [
              { "@type": "Organization", "@id": `${site.url}/#org`, name: site.name, url: site.url, logo: `${site.url}/brand/icon-512.png`, slogan: site.slogan },
              {
                "@type": "WebSite",
                "@id": `${site.url}/#site`,
                name: site.name,
                url: site.url,
                inLanguage: "pt-BR",
                publisher: { "@id": `${site.url}/#org` },
                potentialAction: { "@type": "SearchAction", target: `${site.url}/market?q={search_term_string}`, "query-input": "required name=search_term_string" },
              },
            ],
          }}
        />
        <Header />
        <main id="conteudo" className="flex-1">
          {children}
        </main>
        <Footer />
        <BottomNav />
      </body>
    </html>
  );
}
