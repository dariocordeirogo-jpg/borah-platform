/**
 * Lê os dados de um anúncio a partir do HTML público de uma loja virtual.
 * Fonte principal: JSON-LD schema.org Product (usado por Shopify, Nuvemshop, VTEX, Wix, WooCommerce, Magento…).
 * Reserva: metatags OpenGraph / product:price. Nada aqui acessa a rede; é testável com HTML fixo.
 */

import { parseBRLToCents } from "@/lib/market/format";

export type ImportedListing = {
  title: string;
  description: string | null;
  priceCents: number | null;
  compareAtCents: number | null;
  condition: "new" | "used" | "refurbished";
  images: string[];
  brand: string | null;
  sku: string | null;
  sourceUrl: string;
  sourceName: string;
};

export const MAX_IMPORT_IMAGES = 8;
const MAX_TITLE = 120;
const MAX_DESCRIPTION = 5000;

type Json = unknown;
type Obj = Record<string, Json>;
const isObj = (v: Json): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: Json): Json[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const str = (v: Json): string | null => {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (isObj(v)) return str(v["@value"] ?? v.name ?? v.url ?? v["@id"]);
  return null;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Texto puro a partir de HTML de descrição (sem tags, scripts nem estilos). */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Preço do schema.org ("1299.90", 1299.9, "1.299,90", "R$ 1.299,90") em centavos. */
export function priceToCents(v: Json): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null;
  const s = str(v);
  if (!s) return null;
  const cleaned = s.replace(/[^\d.,]/g, "");
  // "1299.90" (formato de máquina, ponto decimal com 1 ou 2 casas) é o padrão do schema.org
  if (/^\d+\.\d{1,2}$/.test(cleaned)) {
    const c = Math.round(Number(cleaned) * 100);
    return c > 0 ? c : null;
  }
  const c = parseBRLToCents(cleaned);
  return c && c > 0 ? c : null;
}

function conditionOf(v: Json): ImportedListing["condition"] {
  const s = (str(v) ?? "").toLowerCase();
  if (s.includes("used") || s.includes("usado")) return "used";
  if (s.includes("refurbished") || s.includes("recondicionado")) return "refurbished";
  return "new";
}

function absolute(u: string | null, base: URL): string | null {
  if (!u) return null;
  try {
    const url = new URL(decodeEntities(u), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function typesOf(o: Obj): string[] {
  return arr(o["@type"]).map((t) => String(t).toLowerCase());
}

/** Todos os objetos dentro dos blocos JSON-LD (inclui @graph e itens aninhados). */
function* walk(v: Json, depth = 0): Generator<Obj> {
  if (depth > 6) return;
  if (Array.isArray(v)) for (const x of v) yield* walk(x, depth + 1);
  else if (isObj(v)) {
    yield v;
    if (v["@graph"]) yield* walk(v["@graph"], depth + 1);
    if (v.mainEntity) yield* walk(v.mainEntity, depth + 1);
    if (v.itemListElement) yield* walk(v.itemListElement, depth + 1);
    if (v.item) yield* walk(v.item, depth + 1);
  }
}

export function jsonLdBlocks(html: string): Json[] {
  const out: Json[] = [];
  const re = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const raw = m[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g, "");
    try {
      out.push(JSON.parse(raw));
    } catch {
      // Algumas lojas colocam JSON inválido (vírgula sobrando, quebra de linha em string): tenta limpar
      try {
        out.push(JSON.parse(raw.replace(/,\s*([}\]])/g, "$1").replace(/[\u0000-\u001f]+/g, " ")));
      } catch {
        // ignora o bloco
      }
    }
  }
  return out;
}

function offerPrices(offers: Json): { price: number | null; list: number | null } {
  let best: number | null = null;
  let list: number | null = null;
  for (const o of arr(offers)) {
    if (!isObj(o)) continue;
    const currency = (str(o.priceCurrency) ?? "BRL").toUpperCase();
    if (currency !== "BRL") continue;
    const candidates = [o.price, o.lowPrice, isObj(o.priceSpecification) ? o.priceSpecification.price : undefined];
    for (const spec of arr(o.priceSpecification)) {
      if (isObj(spec)) {
        const p = priceToCents(spec.price);
        const kind = (str(spec.priceType) ?? "").toLowerCase();
        if (p && (kind.includes("listprice") || kind.includes("strikethrough"))) list = Math.max(list ?? 0, p);
      }
    }
    for (const c of candidates) {
      const p = priceToCents(c);
      if (p && (best === null || p < best)) best = p;
    }
    if (o.offers) {
      const inner = offerPrices(o.offers);
      if (inner.price && (best === null || inner.price < best)) best = inner.price;
    }
  }
  return { price: best, list };
}

function fromProduct(p: Obj, base: URL): Omit<ImportedListing, "sourceUrl" | "sourceName"> | null {
  let title = str(p.name);
  if (!title) return null;
  let offers = p.offers;
  // ProductGroup (variações): usa a primeira variação com oferta
  if (!offers && p.hasVariant) {
    const v = arr(p.hasVariant).find((x) => isObj(x) && x.offers);
    if (isObj(v)) offers = v.offers;
  }
  const { price, list } = offerPrices(offers);
  const images = new Set<string>();
  for (const img of arr(p.image)) {
    const u = absolute(str(isObj(img) ? (img.contentUrl ?? img.url) : img), base);
    if (u) images.add(u);
  }
  const description = str(p.description);
  title = decodeEntities(title);
  return {
    title: title.slice(0, MAX_TITLE).trim(),
    description: description ? htmlToText(description).slice(0, MAX_DESCRIPTION) || null : null,
    priceCents: price,
    compareAtCents: list && price && list > price ? list : null,
    condition: conditionOf(p.itemCondition ?? (isObj(offers) ? offers.itemCondition : undefined)),
    images: [...images].slice(0, MAX_IMPORT_IMAGES),
    brand: str(isObj(p.brand) ? p.brand.name : p.brand),
    sku: str(p.sku ?? p.mpn ?? p.productID),
  };
}

function meta(html: string, key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name|itemprop)\\s*=\\s*["']${key.replace(/[.:]/g, "\\$&")}["'][^>]*>`,
    "i",
  );
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i);
  const v = content?.[1] ?? content?.[2];
  return v ? decodeEntities(v).trim() || null : null;
}

function allMeta(html: string, key: string): string[] {
  const re = new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${key.replace(/[.:]/g, "\\$&")}["'][^>]*>`, "gi");
  return [...html.matchAll(re)]
    .map((m) => m[0].match(/content\s*=\s*["']([^"']*)["']/i)?.[1])
    .filter((v): v is string => Boolean(v));
}

function siteName(html: string, url: URL): string {
  return meta(html, "og:site_name") ?? url.hostname.replace(/^www\./, "");
}

/** Extrai o anúncio do HTML. Devolve null se a página não traz dados de produto legíveis. */
export function parseListing(html: string, pageUrl: string): ImportedListing | null {
  const base = new URL(pageUrl);
  const source = { sourceUrl: base.toString(), sourceName: siteName(html, base) };

  for (const block of jsonLdBlocks(html)) {
    for (const o of walk(block)) {
      const t = typesOf(o);
      if (t.includes("product") || t.includes("productgroup") || t.includes("individualproduct")) {
        const p = fromProduct(o, base);
        if (p) {
          // Completa fotos com o OpenGraph quando o JSON-LD traz poucas
          if (p.images.length < MAX_IMPORT_IMAGES) {
            for (const og of allMeta(html, "og:image")) {
              const u = absolute(og, base);
              if (u && !p.images.includes(u)) p.images.push(u);
              if (p.images.length >= MAX_IMPORT_IMAGES) break;
            }
          }
          if (!p.priceCents) p.priceCents = priceToCents(meta(html, "product:price:amount") ?? meta(html, "og:price:amount"));
          return { ...p, ...source };
        }
      }
    }
  }

  // Reserva: OpenGraph de produto (precisa ao menos de título e de preço ou foto)
  const title = meta(html, "og:title") ?? decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "");
  const price = priceToCents(meta(html, "product:price:amount") ?? meta(html, "og:price:amount"));
  const currency = (meta(html, "product:price:currency") ?? meta(html, "og:price:currency") ?? "BRL").toUpperCase();
  const images = [...new Set(allMeta(html, "og:image").map((u) => absolute(u, base)).filter((u): u is string => Boolean(u)))].slice(
    0,
    MAX_IMPORT_IMAGES,
  );
  const isProduct = (meta(html, "og:type") ?? "").toLowerCase().includes("product") || price !== null;
  if (!title || !isProduct || (!price && !images.length)) return null;
  const desc = meta(html, "og:description") ?? meta(html, "description");
  return {
    title: title.slice(0, MAX_TITLE).trim(),
    description: desc ? desc.slice(0, MAX_DESCRIPTION) : null,
    priceCents: currency === "BRL" ? price : null,
    compareAtCents: null,
    condition: conditionOf(meta(html, "product:condition")),
    images,
    brand: meta(html, "product:brand"),
    sku: null,
    ...source,
  };
}
