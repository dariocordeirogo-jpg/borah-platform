import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { BottomNav } from "@/components/bottom-nav";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: {
    default: "BORAH — Assista. Compre. Venda. Ganhe.",
    template: "%s · BORAH",
  },
  description:
    "Plataforma brasileira de comércio social: leilões, lives, vídeos, marketplace e afiliados em um só lugar.",
  applicationName: "BORAH",
};

export const viewport: Viewport = {
  themeColor: "#168447",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${sora.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Pular para o conteúdo
        </a>
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
