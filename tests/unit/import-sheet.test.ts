import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { detectPlatform, findHeaderRow, guessMapping, norm, parseCsv, parseXlsx, rowsToListings } from "@/lib/importer/sheet";

/** .xlsx mínimo (uma aba, textos em sharedStrings) para testar a leitura sem arquivo binário no repositório. */
function xlsx(rows: (string | number)[][]): Uint8Array {
  const shared: string[] = [];
  const idx = (s: string) => (shared.includes(s) ? shared.indexOf(s) : shared.push(s) - 1);
  const col = (i: number) => String.fromCharCode(65 + i);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const sheetRows = rows
    .map(
      (r, ri) =>
        `<row r="${ri + 1}">${r
          .map((v, ci) => (typeof v === "number" ? `<c r="${col(ci)}${ri + 1}"><v>${v}</v></c>` : `<c r="${col(ci)}${ri + 1}" t="s"><v>${idx(v)}</v></c>`))
          .join("")}</row>`,
    )
    .join("");
  return zipSync({
    "xl/workbook.xml": strToU8('<workbook><sheets><sheet name="Anúncios" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
    "xl/worksheets/sheet1.xml": strToU8(`<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`),
    "xl/sharedStrings.xml": strToU8(`<sst>${shared.map((s) => `<si><t>${esc(s)}</t></si>`).join("")}</sst>`),
  });
}

describe("Importar em massa: leitura da planilha", () => {
  it("CSV com ponto e vírgula, aspas, quebra de linha e BOM", () => {
    const rows = parseCsv('﻿Título;Preço;Descrição\r\n"Camiseta ""Básica""";89,90;"linha 1\nlinha 2"\r\n;;\r\n');
    expect(rows).toEqual([
      ["Título", "Preço", "Descrição"],
      ['Camiseta "Básica"', "89,90", "linha 1\nlinha 2"],
    ]);
  });

  it("CSV com vírgula (Shopify)", () => {
    expect(parseCsv("Handle,Title,Variant Price\nbone,Boné,49.90")[1]).toEqual(["bone", "Boné", "49.90"]);
  });

  it("XLSX: lê a primeira aba, textos compartilhados e números, respeitando colunas vazias", () => {
    const rows = parseXlsx(xlsx([["Título", "Preço", "Estoque"], ["Tênis & Cia", 199.9, 3]]));
    expect(rows[0]).toEqual(["Título", "Preço", "Estoque"]);
    expect(rows[1]).toEqual(["Tênis & Cia", "199.9", "3"]);
  });

  it("acha o cabeçalho abaixo das linhas de instrução (planilhas de marketplace)", () => {
    const rows = [["Não altere o cabeçalho"], ["Preencha a partir da linha 4"], ["ID do anúncio", "Título", "Preço", "Estoque", "SKU"], ["MLB1", "Fone", "120", "5", "F-1"]];
    expect(findHeaderRow(rows)).toBe(2);
  });

  it("reconhece colunas com e sem acento, em português e inglês", () => {
    expect(norm("Preço de Venda (R$)")).toBe("preco de venda r");
    const m = guessMapping(["ID do anúncio", "Título", "Preço", "Quantidade disponível", "SKU", "Condição", "Imagem 1", "Imagem 2"]);
    expect(m.title).toEqual([1]);
    expect(m.price).toEqual([2]);
    expect(m.stock).toEqual([3]);
    expect(m.sku).toEqual([4]);
    expect(m.condition).toEqual([5]);
    expect(m.images).toEqual([6, 7]);
    const shopee = guessMapping(["Nome do Produto", "Descrição do Produto", "Preço", "Estoque", "Imagem de capa", "Imagem 1", "Peso"]);
    expect(shopee.title).toEqual([0]);
    expect(shopee.description).toEqual([1]);
    expect(shopee.images).toEqual([4, 5]);
    expect(shopee.weight).toEqual([6]);
  });

  it("mostra a plataforma provável", () => {
    expect(detectPlatform(["Handle", "Title", "Variant Price"])).toBe("Shopify");
    expect(detectPlatform(["ID do anúncio", "Título"])).toBe("Mercado Livre");
    expect(detectPlatform(["Nome do Produto", "Imagem de capa"])).toBe("Shopee");
    expect(detectPlatform(["Título", "Preço"])).toBe("Planilha");
  });

  it("Shopify: junta as linhas do mesmo Handle num anúncio só, com todas as fotos", () => {
    const rows = parseCsv(
      [
        "Handle,Title,Body (HTML),Vendor,Variant Price,Variant Compare At Price,Variant Inventory Qty,Image Src",
        "bone,Boné Aba Reta,<p>Algodão</p>,Zexi,49.90,79.90,10,https://cdn.shop/a.jpg",
        "bone,,,,,,,https://cdn.shop/b.jpg",
        "meia,Meia,,,19.90,,0,https://cdn.shop/c.jpg",
      ].join("\n"),
    );
    const list = rowsToListings(rows, 0, guessMapping(rows[0]));
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ title: "Boné Aba Reta", price: "49.90", compareAt: "79.90", stock: "10", brand: "Zexi" });
    expect(list[0].images).toEqual(["https://cdn.shop/a.jpg", "https://cdn.shop/b.jpg"]);
    expect(list[1].title).toBe("Meia");
  });

  it("fotos em várias colunas ou separadas por vírgula; só links http(s); máximo de 5", () => {
    const rows = [
      ["Título", "Preço", "Imagens", "Imagem 2"],
      ["Bolsa", "R$ 1.299,90", "https://a/1.jpg, https://a/2.jpg ftp://x/3.jpg", "https://a/4.jpg"],
      ["Carteira", "80", "https://a/1.jpg;https://a/2.jpg;https://a/3.jpg;https://a/4.jpg;https://a/5.jpg;https://a/6.jpg", ""],
      ["", "10", "", ""],
    ];
    const list = rowsToListings(rows, 0, guessMapping(rows[0]));
    expect(list.map((l) => l.title)).toEqual(["Bolsa", "Carteira"]);
    expect(list[0].images).toEqual(["https://a/1.jpg", "https://a/2.jpg", "https://a/4.jpg"]);
    expect(list[1].images).toHaveLength(5);
  });

  it("condição usado/recondicionado e link do anúncio só se for http(s)", () => {
    const rows = [
      ["Título", "Preço", "Condição", "Link"],
      ["A", "1", "Usado", "https://loja/a"],
      ["B", "1", "Recondicionado", "javascript:alert(1)"],
      ["C", "1", "Novo", ""],
    ];
    const list = rowsToListings(rows, 0, guessMapping(rows[0]));
    expect(list.map((l) => l.condition)).toEqual(["used", "refurbished", "new"]);
    expect(list.map((l) => l.link)).toEqual(["https://loja/a", "", ""]);
  });
});
