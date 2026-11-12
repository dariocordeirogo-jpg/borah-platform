"use client";

import { startTransition, useActionState, useState } from "react";
import { Check, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmImport, previewImport, type PreviewState } from "@/lib/importer/actions";
import type { FormState } from "@/lib/market/actions";
import { centsToInput } from "@/lib/market/format";
import { cn } from "@/lib/utils";

const input =
  "w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-navy-2 focus:ring-2 focus:ring-navy-2/20 aria-[invalid=true]:border-danger";

function Label({ htmlFor, children, hint }: { htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-navy">
      {children} {hint && <span className="font-normal text-muted">({hint})</span>}
    </label>
  );
}

function Err({ state, name }: { state: FormState; name: string }) {
  const e = state.fieldErrors?.[name]?.[0];
  return e ? (
    <p id={`${name}-erro`} className="mt-1 text-sm text-danger">
      {e}
    </p>
  ) : null;
}

/** Fluxo em dois passos: colar o link → revisar e importar como rascunho. */
export function ImportFlow({ categories }: { categories: { id: number; name: string }[] }) {
  const [preview, previewAction, previewing] = useActionState<PreviewState, FormData>(previewImport, {});
  const [state, confirmAction, saving] = useActionState<FormState, FormData>(confirmImport, {});
  const l = preview.listing;
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const selected = chosen ?? new Set(l?.images ?? []);
  const toggle = (u: string) => {
    const next = new Set(selected);
    if (next.has(u)) next.delete(u);
    else next.add(u);
    setChosen(next);
  };
  const f = (name: string) => ({
    id: name,
    name,
    "aria-invalid": state.fieldErrors?.[name] ? true : undefined,
    "aria-describedby": `${name}-erro`,
  });

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          // Envio manual (sem o "action" do form): o React não limpa o campo depois do envio
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setChosen(null);
          startTransition(() => previewAction(fd));
        }}
        className="rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[var(--shadow-card)] sm:p-5"
      >
        <Label htmlFor="url">Link do anúncio</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              id="url"
              name="url"
              type="url"
              inputMode="url"
              required
              placeholder="https://sualoja.com.br/produtos/..."
              className={`${input} h-12 pl-9`}
              aria-describedby="url-ajuda"
            />
          </div>
          <Button type="submit" size="lg" disabled={previewing} className="sm:w-auto">
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {previewing ? "Lendo o anúncio…" : "Buscar anúncio"}
          </Button>
        </div>
        <p id="url-ajuda" className="mt-2 text-xs text-muted">
          Funciona com lojas virtuais (Shopify, Nuvemshop, VTEX, Wix, WooCommerce, Tray e outras). Você revisa tudo antes de importar; o
          produto entra como rascunho.
        </p>
        {preview.error && (
          <p role="alert" data-testid="importar-erro" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
            {preview.error}
          </p>
        )}
      </form>

      {l && (
        <form
          key={l.sourceUrl}
          onSubmit={(e) => {
            // Mantém o que a loja preencheu (categoria, preço…) quando o servidor devolve um erro
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => confirmAction(fd));
          }}
          className="space-y-4 rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[var(--shadow-card)] sm:p-5" noValidate>
          <input type="hidden" name="sourceUrl" value={l.sourceUrl} />
          {[...selected].map((u) => (
            <input key={u} type="hidden" name="image" value={u} />
          ))}
          <p className="text-sm text-muted">
            Encontramos este anúncio em <strong className="text-navy">{l.sourceName}</strong>. Confira e ajuste antes de importar.
          </p>
          {state.error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}

          {l.images.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-navy">
                Fotos <span className="font-normal text-muted">({selected.size} de {l.images.length} selecionadas)</span>
              </legend>
              <ul className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {l.images.map((u, i) => {
                  const on = selected.has(u);
                  return (
                    <li key={u}>
                      <button
                        type="button"
                        onClick={() => toggle(u)}
                        aria-pressed={on}
                        aria-label={`Foto ${i + 1}${on ? " (selecionada)" : ""}`}
                        className={cn(
                          "relative block aspect-square w-full overflow-hidden rounded-lg border-2 bg-white",
                          on ? "border-brand" : "border-line opacity-50",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- foto externa só para pré-visualização */}
                        <img src={u} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-contain" />
                        {on && (
                          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                            <Check className="h-3 w-3" aria-hidden="true" />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          )}

          <div>
            <Label htmlFor="title">Título</Label>
            <input {...f("title")} defaultValue={l.title} maxLength={120} className={`${input} h-11`} />
            <Err state={state} name="title" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="categoryId">Categoria</Label>
              <select {...f("categoryId")} defaultValue="" className={`${input} h-11`}>
                <option value="" disabled>
                  Escolha…
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Err state={state} name="categoryId" />
            </div>
            <div>
              <Label htmlFor="condition">Condição</Label>
              <select {...f("condition")} defaultValue={l.condition} className={`${input} h-11`}>
                <option value="new">Novo</option>
                <option value="used">Usado</option>
                <option value="refurbished">Recondicionado</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <Label htmlFor="price">Preço (R$)</Label>
              <input {...f("price")} inputMode="decimal" defaultValue={centsToInput(l.priceCents ?? undefined)} placeholder="199,90" className={`${input} h-11`} />
              <Err state={state} name="price" />
            </div>
            <div>
              <Label htmlFor="compareAt" hint="opcional">
                Preço anterior
              </Label>
              <input {...f("compareAt")} inputMode="decimal" defaultValue={centsToInput(l.compareAtCents ?? undefined)} className={`${input} h-11`} />
              <Err state={state} name="compareAt" />
            </div>
            <div>
              <Label htmlFor="stock">Estoque</Label>
              <input {...f("stock")} type="number" min={0} max={100000} defaultValue={1} className={`${input} h-11`} />
              <Err state={state} name="stock" />
            </div>
            <div>
              <Label htmlFor="weight" hint="com embalagem">
                Peso (g)
              </Label>
              <input {...f("weight")} type="number" min={1} max={30000} defaultValue={500} className={`${input} h-11`} />
              <Err state={state} name="weight" />
            </div>
          </div>
          <div>
            <Label htmlFor="description" hint="opcional">
              Descrição
            </Label>
            <textarea {...f("description")} rows={6} maxLength={5000} defaultValue={l.description ?? ""} className={`${input} py-2`} />
          </div>
          <div>
            <label className="flex items-start gap-3 rounded-xl bg-surface p-3 text-sm text-ink">
              <input
                type="checkbox"
                name="owner"
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand)]"
                aria-invalid={state.fieldErrors?.owner ? true : undefined}
                aria-describedby="owner-erro"
              />
              <span>
                Confirmo que este anúncio é da minha loja (ou que tenho autorização para usar as fotos e o texto). Anúncios copiados de
                outros vendedores podem ser removidos.
              </span>
            </label>
            <Err state={state} name="owner" />
          </div>
          <Button type="submit" size="lg" disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {saving ? "Importando fotos…" : "Importar como rascunho"}
          </Button>
        </form>
      )}
    </div>
  );
}
