import { env } from "@/lib/env";

/** Página da loja personalizada: cores, limites e endereço das imagens (pode ir ao navegador). */

export const STORE_MEDIA_BUCKET = "store-media";
export const MAX_BANNERS = 5;
export const MAX_FEATURED = 12;

export const STORE_THEMES = {
  laranja: { label: "Laranja", bg: "bg-[#FF4D2D]", text: "text-[#FF4D2D]", from: "from-[#FF4D2D]", to: "to-[#B8321A]" },
  grafite: { label: "Grafite", bg: "bg-[#0F1115]", text: "text-[#0F1115]", from: "from-[#2A2E37]", to: "to-[#0F1115]" },
  azul: { label: "Azul", bg: "bg-[#1D4ED8]", text: "text-[#1D4ED8]", from: "from-[#2563EB]", to: "to-[#1E3A8A]" },
  verde: { label: "Verde", bg: "bg-[#15803D]", text: "text-[#15803D]", from: "from-[#16A34A]", to: "to-[#14532D]" },
  roxo: { label: "Roxo", bg: "bg-[#7E22CE]", text: "text-[#7E22CE]", from: "from-[#9333EA]", to: "to-[#4C1D95]" },
  vermelho: { label: "Vermelho", bg: "bg-[#B91C1C]", text: "text-[#B91C1C]", from: "from-[#DC2626]", to: "to-[#7F1D1D]" },
  rosa: { label: "Rosa", bg: "bg-[#DB2777]", text: "text-[#DB2777]", from: "from-[#EC4899]", to: "to-[#831843]" },
  turquesa: { label: "Turquesa", bg: "bg-[#0F766E]", text: "text-[#0F766E]", from: "from-[#14B8A6]", to: "to-[#134E4A]" },
} as const;
export type StoreTheme = keyof typeof STORE_THEMES;
export const isStoreTheme = (v: unknown): v is StoreTheme => typeof v === "string" && v in STORE_THEMES;
export const themeOf = (v: string | null | undefined) => STORE_THEMES[isStoreTheme(v) ? v : "laranja"];

export function storeMediaUrl(path: string): string {
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${STORE_MEDIA_BUCKET}/${path}`;
}

export function storeErrorMessage(message?: string): string {
  switch ((message ?? "").split(":")[0]) {
    case "too_many_banners":
      return `A loja pode ter até ${MAX_BANNERS} banners. Apague um para enviar outro.`;
    case "too_many_featured":
      return `Escolha até ${MAX_FEATURED} produtos em destaque.`;
    case "product_not_found":
      return "Escolha um produto da sua loja.";
    default:
      return "Não foi possível salvar agora. Tente de novo.";
  }
}
