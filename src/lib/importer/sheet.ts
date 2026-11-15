/**
 * Importação em massa por planilha: lê CSV ou XLSX exportado de outra plataforma (Mercado Livre, Shopee, Shopify,
 * Nuvemshop, Bling, Tray…), acha a linha de cabeçalho, sugere qual coluna é cada campo e monta os anúncios.
 * Roda no navegador (o arquivo não sobe para o servidor); quem valida e grava é o servidor. Nada aqui acessa a rede.
 */
import { strFromU8, unzipSync } from "fflate";

export type Sheet = string[][];

export const bulkFields = ["title", "description", "price", "compareAt", "stock", "sku", "condition", "weight", "brand", "images", "group", "link"] as const;
export type BulkField = (typeof bulkFields)[number];
export type Mapping = Record<BulkField, number[]>;

export const bulkFieldLabel: Record<BulkField, string> = {
  title: "Título",
  description: "Descrição",
  price: "Preço",
  compareAt: "Preço anterior (riscado)",
  stock: "Estoque",
  sku: "SKU / código",
  condition: "Condição",
  weight: "Peso (g)",
  brand: "Marca",
  images: "Fotos (links)",
  group: "Agrupar linhas por (ex.: Handle)",
  link: "Link do anúncio",
};

export const MAX_BULK_ROWS = 500;
export const MAX_BULK_IMAGES = 5;

export type BulkRow = {
  title: string;
  description: string;
  price: string;
  compareAt: string;
  stock: string;
  sku: string;
  condition: "new" | "used" | "refurbished";
  weight: string;
  brand: string;
  images: string[];
  link: string;
};

/** "Preço de Venda (R$)" → "preco de venda r" — sem acento, minúsculo, só letras e números. */
export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Nomes de coluna conhecidos (já normalizados). Exatos primeiro; depois "começa com" para variações.
const SYNONYMS: Record<Exclude<BulkField, "images">, { exact: string[]; prefix?: string[] }> = {
  title: { exact: ["title", "titulo", "nome", "nome do produto", "titulo do anuncio", "produto", "product name", "name", "nome do anuncio", "descricao curta"] },
  description: { exact: ["body html", "descricao", "description", "descricao do produto", "descricao completa", "detalhes"] },
  price: { exact: ["variant price", "preco", "price", "preco de venda", "preco r", "valor", "preco venda", "preco unitario", "preco promocional"] },
  compareAt: { exact: ["variant compare at price", "preco original", "preco de", "preco anterior", "preco cheio", "preco sem desconto", "compare at price"] },
  stock: { exact: ["variant inventory qty", "estoque", "quantidade", "quantidade disponivel", "stock", "qtd", "qtde", "estoque disponivel", "inventory"] },
  sku: { exact: ["variant sku", "sku", "codigo", "sku de referencia", "codigo sku", "sku principal", "referencia", "id do produto", "codigo do produto"] },
  condition: { exact: ["condicao", "condition", "estado", "condicao do item"] },
  weight: { exact: ["variant grams", "peso", "peso g", "peso gramas", "peso em gramas", "weight", "peso bruto g"] },
  brand: { exact: ["vendor", "marca", "brand", "fabricante"] },
  group: { exact: ["handle", "url handle", "id pai", "codigo pai", "sku pai"] },
  link: { exact: ["link", "url", "link do anuncio", "permalink", "url do produto", "link do produto"] },
};
const IMAGE_COLUMN = /^(image src|imagem|imagens|foto|fotos|url da imagem|link da imagem|imagem de capa|imagem principal|item image|picture|pictures|images|image)( \d{1,2})?$/;

/** Sugere as colunas de cada campo a partir dos nomes do cabeçalho. */
export function guessMapping(header: string[]): Mapping {
  const h = header.map(norm);
  const m = Object.fromEntries(bulkFields.map((f) => [f, [] as number[]])) as Mapping;
  for (const [field, syn] of Object.entries(SYNONYMS) as [Exclude<BulkField, "images">, { exact: string[] }][]) {
    const i = h.findIndex((x) => syn.exact.includes(x));
    if (i >= 0) m[field] = [i];
  }
  h.forEach((x, i) => {
    if (IMAGE_COLUMN.test(x)) m.images.push(i);
  });
  return m;
}

/** Plataforma provável, só para mostrar ao vendedor. */
export function detectPlatform(header: string[]): string {
  const h = new Set(header.map(norm));
  if (h.has("handle") && h.has("variant price")) return "Shopify";
  if (h.has("id do anuncio") || [...h].some((x) => x.includes("mercado"))) return "Mercado Livre";
  if ([...h].some((x) => x.startsWith("imagem de capa") || x.includes("shopee") || x === "id do produto pai")) return "Shopee";
  if (h.has("url do produto") && h.has("nome")) return "Nuvemshop";
  return "Planilha";
}

/** Acha a linha de cabeçalho nas 15 primeiras (planilhas de marketplace costumam ter instruções acima). */
export function findHeaderRow(rows: Sheet): number {
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const m = guessMapping(rows[i]);
    const score = (m.title.length ? 3 : 0) + (m.price.length ? 2 : 0) + bulkFields.filter((f) => m[f].length).length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

/** CSV com vírgula, ponto e vírgula ou tab (detectado na 1ª linha), aspas e quebras de linha dentro de aspas. */
export function parseCsv(text: string): Sheet {
  const src = text.replace(/^﻿/, "");
  const nl = src.indexOf("\n");
  const firstLine = nl === -1 ? src : src.slice(0, nl);
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let q = false;
  for (const ch of firstLine) {
    if (ch === '"') q = !q;
    else if (!q && ch in counts) counts[ch]++;
  }
  const [topSep, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const sep = topCount ? topSep : ",";
  const rows: Sheet = [];
  let row: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQ = false;
      } else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const XML_ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unxml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : XML_ENT[e.toLowerCase()],
  );
const textOf = (xml: string) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unxml(m[1])).join("");

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Primeira aba de um .xlsx (Excel 2007+). Arquivo .xls antigo não é aceito: salve como .xlsx ou CSV. */
export function parseXlsx(bytes: Uint8Array, maxRows = MAX_BULK_ROWS * 20 + 20): Sheet {
  const files = unzipSync(bytes, { filter: (f) => f.name.startsWith("xl/") && f.name.endsWith(".xml") || f.name.endsWith(".rels") });
  const read = (name: string) => (files[name] ? strFromU8(files[name]) : "");
  const shared = [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  // Primeira aba pela ordem do workbook
  const wb = read("xl/workbook.xml");
  const rid = wb.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  const rels = read("xl/_rels/workbook.xml.rels");
  const target = rid ? new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] ?? rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`))?.[1] : null;
  const path = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`) : "xl/worksheets/sheet1.xml";
  const sheet = read(path) || read("xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("xlsx_empty");
  const rows: Sheet = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const body = cm[2] ?? "";
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = textOf(body);
      else if (v !== undefined) value = unxml(v);
      const i = ref ? colIndex(ref) : row.length;
      while (row.length < i) row.push("");
      row[i] = value;
    }
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    if (rows.length >= maxRows) break;
  }
  return rows;
}

function conditionOf(v: string): BulkRow["condition"] {
  const s = norm(v);
  if (s.includes("usad") || s.includes("used") || s.includes("semi")) return "used";
  if (s.includes("recond") || s.includes("refurb")) return "refurbished";
  return "new";
}

const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s);

/** Linhas da planilha → anúncios. Linhas com o mesmo "grupo" (Shopify: Handle) viram um anúncio só, juntando as fotos. */
export function rowsToListings(rows: Sheet, headerRow: number, m: Mapping): BulkRow[] {
  const get = (r: string[], f: BulkField) => (m[f][0] !== undefined ? (r[m[f][0]] ?? "").trim() : "");
  const out: BulkRow[] = [];
  const byGroup = new Map<string, BulkRow>();
  for (const r of rows.slice(headerRow + 1)) {
    const images = m.images
      .flatMap((i) => (r[i] ?? "").split(/[\s,;|]+/))
      .map((s) => s.trim())
      .filter(isUrl);
    const group = get(r, "group");
    const existing = group ? byGroup.get(group) : undefined;
    if (existing) {
      for (const u of images) if (!existing.images.includes(u)) existing.images.push(u);
      if (!existing.title && get(r, "title")) existing.title = get(r, "title");
      continue;
    }
    const title = get(r, "title");
    if (!title && !group) continue;
    const link = get(r, "link");
    const row: BulkRow = {
      title,
      description: get(r, "description"),
      price: get(r, "price"),
      compareAt: get(r, "compareAt"),
      stock: get(r, "stock"),
      sku: get(r, "sku"),
      condition: conditionOf(get(r, "condition")),
      weight: get(r, "weight"),
      brand: get(r, "brand"),
      images: [...new Set(images)],
      link: isUrl(link) ? link : "",
    };
    out.push(row);
    if (group) byGroup.set(group, row);
    if (out.length >= MAX_BULK_ROWS) break;
  }
  return out.filter((r) => r.title).map((r) => ({ ...r, images: r.images.slice(0, MAX_BULK_IMAGES) }));
}
