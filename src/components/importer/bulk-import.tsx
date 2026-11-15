"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileSpreadsheet, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importLinks, importSheetRows, type BulkResult } from "@/lib/importer/bulk-actions";
import { priceToCents } from "@/lib/importer/parse";
import {
  bulkFieldLabel,
  bulkFields,
  detectPlatform,
  findHeaderRow,
  guessMapping,
  MAX_BULK_ROWS,
  parseCsv,
  parseXlsx,
  rowsToListings,
  type BulkField,
  type Mapping,
  type Sheet,
} from "@/lib/importer/sheet";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

const select = "h-10 w-full rounded-xl border border-line bg-white px-2 text-sm";
const ROWS_PER_CALL = 5;
const LINKS_PER_CALL = 3;

type Mode = "sheet" | "links";

/** Importar vários anúncios: planilha exportada da outra plataforma ou uma lista de links. Tudo entra como rascunho. */
export function BulkImport({ categories }: { categories: { id: number; name: string }[] }) {
  const [mode, setMode] = useState<Mode>("sheet");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [fileName, setFileName] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [links, setLinks] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [owner, setOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<BulkResult[]>([]);

  const header = sheet?.[headerRow] ?? [];
  const listings = useMemo(() => (sheet && mapping ? rowsToListings(sheet, headerRow, mapping) : []), [sheet, headerRow, mapping]);
  const urls = useMemo(
    () => [...new Set(links.split(/\s+/).map((s) => s.trim()).filter((s) => /^https?:\/\/\S+$/i.test(s)))].slice(0, 100),
    [links],
  );

  async function onFile(file: File) {
    setError(null);
    setResults([]);
    try {
      const isXlsx = /\.xlsx$/i.test(file.name);
      if (/\.xls$/i.test(file.name)) throw new Error("xls");
      const rows = isXlsx ? parseXlsx(new Uint8Array(await file.arrayBuffer())) : parseCsv(await file.text());
      if (rows.length < 2) throw new Error("empty");
      const h = findHeaderRow(rows);
      setSheet(rows);
      setFileName(file.name);
      setHeaderRow(h);
      setMapping(guessMapping(rows[h]));
    } catch (e) {
      setSheet(null);
      setMapping(null);
      setError(
        (e as Error).message === "xls"
          ? "Arquivo .xls antigo: abra no Excel ou Google Planilhas e salve como .xlsx ou .csv."
          : "Não conseguimos ler essa planilha. Use o arquivo .xlsx ou .csv exportado da plataforma.",
      );
    }
  }

  function setField(f: BulkField, value: string) {
    if (!mapping) return;
    const cols = value === "" ? [] : [Number(value)];
    setMapping({ ...mapping, [f]: f === "images" && value !== "" ? [...new Set([...mapping.images, Number(value)])] : cols });
  }

  async function run() {
    setError(null);
    if (!categoryId) return setError("Escolha a categoria dos anúncios (dá para trocar depois em cada produto).");
    if (!owner) return setError("Confirme que os anúncios são seus.");
    const total = mode === "sheet" ? listings.length : urls.length;
    if (!total) return setError(mode === "sheet" ? "Nenhum anúncio encontrado na planilha." : "Cole pelo menos um link.");
    setRunning(true);
    setResults([]);
    setProgress({ done: 0, total });
    const all: BulkResult[] = [];
    const size = mode === "sheet" ? ROWS_PER_CALL : LINKS_PER_CALL;
    for (let i = 0; i < total; i += size) {
      const r =
        mode === "sheet"
          ? await importSheetRows({ categoryId, owner: true, rows: listings.slice(i, i + size) })
          : await importLinks({ categoryId, owner: true, urls: urls.slice(i, i + size) });
      if (r.error) {
        setError(r.error);
        break;
      }
      all.push(...(r.results ?? []));
      setResults([...all]);
      setProgress({ done: Math.min(i + size, total), total });
    }
    setRunning(false);
  }

  const created = results.filter((r) => r.ok).length;

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Como importar" className="flex gap-2">
        {(
          [
            ["sheet", "Planilha (Mercado Livre, Shopee, Shopify…)", FileSpreadsheet],
            ["links", "Vários links", Link2],
          ] as const
        ).map(([m, label, Icon]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold",
              mode === m ? "border-brand bg-brand text-white" : "border-line bg-white text-navy hover:border-navy-2",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {mode === "sheet" ? (
        <section className="space-y-4 rounded-[var(--radius-card)] border border-line bg-white p-5" aria-label="Importar por planilha">
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-navy">Como baixar a planilha dos seus anúncios</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              <li>
                <strong>Mercado Livre:</strong> Anúncios → selecione os anúncios → Modificar em massa → Modificar em Excel (baixe o arquivo).
              </li>
              <li>
                <strong>Shopee:</strong> Central do Vendedor → Meus Produtos → Ferramentas em massa → Atualização em massa → baixe as informações dos produtos.
              </li>
              <li>
                <strong>Shopify:</strong> Produtos → Exportar → arquivo CSV.
              </li>
              <li>
                <strong>Nuvemshop, Bling, Tray e outras:</strong> use a opção de exportar produtos em CSV ou Excel.
              </li>
            </ul>
            <p className="mt-2 text-xs text-muted">Se a planilha não trouxer fotos, os produtos entram sem foto e você adiciona depois.</p>
          </details>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-navy">Arquivo (.xlsx ou .csv)</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label="Planilha de anúncios"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-navy file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
          </label>

          {sheet && mapping && (
            <div className="space-y-4">
              <p className="text-sm" data-testid="planilha-resumo">
                <strong className="text-navy">{fileName}</strong> · {detectPlatform(header)} · <strong>{listings.length}</strong> anúncio(s)
                {listings.length >= MAX_BULK_ROWS && ` (máximo de ${MAX_BULK_ROWS} por vez)`}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-navy">Linha do cabeçalho</span>
                  <select
                    className={select}
                    value={headerRow}
                    onChange={(e) => {
                      const h = Number(e.target.value);
                      setHeaderRow(h);
                      setMapping(guessMapping(sheet[h]));
                    }}
                  >
                    {sheet.slice(0, 15).map((r, i) => (
                      <option key={i} value={i}>
                        Linha {i + 1}: {r.filter(Boolean).slice(0, 4).join(" | ").slice(0, 80)}
                      </option>
                    ))}
                  </select>
                </label>
                {bulkFields.map((f) =>
                  f === "images" ? (
                    <div key={f} className="sm:col-span-2">
                      <span className="mb-1 block text-xs font-semibold text-navy">{bulkFieldLabel[f]}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {mapping.images.map((i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setMapping({ ...mapping, images: mapping.images.filter((x) => x !== i) })}
                            className="rounded-full bg-navy-soft px-3 py-1 text-xs text-navy"
                            aria-label={`Tirar a coluna ${header[i]} das fotos`}
                          >
                            {header[i] || `Coluna ${i + 1}`} ×
                          </button>
                        ))}
                        <select className={cn(select, "w-auto")} value="" onChange={(e) => setField("images", e.target.value)} aria-label="Adicionar coluna de fotos">
                          <option value="">+ coluna de fotos</option>
                          {header.map((h, i) => (
                            <option key={i} value={i}>
                              {h || `Coluna ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <label key={f} className="block">
                      <span className="mb-1 block text-xs font-semibold text-navy">{bulkFieldLabel[f]}</span>
                      <select className={select} value={mapping[f][0] ?? ""} onChange={(e) => setField(f, e.target.value)} aria-label={`Coluna de ${bulkFieldLabel[f]}`}>
                        <option value="">— não usar —</option>
                        {header.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Coluna ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  ),
                )}
              </div>

              {listings.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm" data-testid="planilha-previa">
                    <caption className="mb-1 text-left text-xs text-muted">Prévia dos primeiros anúncios</caption>
                    <thead className="text-xs text-muted">
                      <tr>
                        <th className="py-1 pr-2">Título</th>
                        <th className="py-1 pr-2">Preço</th>
                        <th className="py-1 pr-2">Estoque</th>
                        <th className="py-1">Fotos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {listings.slice(0, 8).map((l, i) => {
                        const cents = priceToCents(l.price);
                        return (
                          <tr key={i}>
                            <td className="max-w-[260px] truncate py-1.5 pr-2 text-navy">{l.title}</td>
                            <td className="py-1.5 pr-2">{cents ? formatBRL(cents) : <span className="text-danger">sem preço</span>}</td>
                            <td className="py-1.5 pr-2">{l.stock || "1"}</td>
                            <td className="py-1.5">{l.images.length}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-3 rounded-[var(--radius-card)] border border-line bg-white p-5" aria-label="Importar por links">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-navy">Links dos anúncios (um por linha, até 100)</span>
            <textarea
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              rows={6}
              aria-label="Links dos anúncios"
              placeholder={"https://sualoja.com.br/produtos/camiseta\nhttps://sualoja.com.br/produtos/bone"}
              className="w-full rounded-xl border border-line p-3 text-sm"
            />
          </label>
          <p className="text-xs text-muted">
            Funciona com lojas próprias (Shopify, Nuvemshop, VTEX, WooCommerce, Tray, Loja Integrada e outras). Mercado Livre e Shopee bloqueiam a
            leitura de páginas: para eles, use a planilha. {urls.length > 0 && <strong>{urls.length} link(s) válido(s).</strong>}
          </p>
        </section>
      )}

      <section className="space-y-3 rounded-[var(--radius-card)] border border-line bg-white p-5" aria-label="Confirmar importação">
        <label className="block max-w-sm">
          <span className="mb-1 block text-sm font-medium text-navy">Categoria dos anúncios</span>
          <select className={select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Categoria dos anúncios">
            <option value="">Escolha…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={owner} onChange={(e) => setOwner(e.target.checked)} className="mt-1" />
          <span>Os anúncios são meus (ou tenho autorização para usar as fotos e os textos).</span>
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="button" onClick={run} disabled={running}>
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Importando {progress.done}/{progress.total}…
            </>
          ) : (
            `Importar ${mode === "sheet" ? listings.length : urls.length} anúncio(s) como rascunho`
          )}
        </Button>
      </section>

      {results.length > 0 && (
        <section aria-label="Resultado da importação" className="rounded-[var(--radius-card)] border border-line bg-white p-5" data-testid="resultado-importacao">
          <h2 className="font-semibold text-navy">
            {created} de {results.length} criado(s) como rascunho
          </h2>
          <p className="text-xs text-muted">Revise preço, categoria e fotos em cada produto e ative quando estiver pronto.</p>
          <ul className="mt-3 divide-y divide-line text-sm">
            {results.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate">{r.title}</span>
                {r.ok && r.productId ? (
                  <Link href={`/seller/produtos/${r.productId}`} className="shrink-0 text-brand hover:underline">
                    Revisar ({r.photos ?? 0} foto{r.photos === 1 ? "" : "s"})
                  </Link>
                ) : (
                  <span className="shrink-0 text-danger">{r.error}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
