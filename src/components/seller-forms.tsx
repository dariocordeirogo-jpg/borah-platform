"use client";

import { useActionState, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/market/actions";
import { centsToInput, slugify } from "@/lib/market/format";
import { createStore, saveProduct, updateStore, uploadProductImages } from "@/app/seller/actions";
import { DescribeWithAI } from "@/components/ai/describe-button";

const input =
  "w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-navy-2 focus:ring-2 focus:ring-navy-2/20 aria-[invalid=true]:border-danger";

function Err({ id, state, name }: { id: string; state: FormState; name: string }) {
  const e = state.fieldErrors?.[name]?.[0];
  return e ? (
    <p id={id} className="mt-1 text-sm text-danger">
      {e}
    </p>
  ) : null;
}

function Alerts({ state }: { state: FormState }) {
  return (
    <>
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="rounded-xl bg-success-soft px-3 py-2 text-sm text-success">
          {state.message}
        </p>
      )}
    </>
  );
}

function Label({ htmlFor, children, hint }: { htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-navy">
      {children} {hint && <span className="font-normal text-muted">({hint})</span>}
    </label>
  );
}

export function CreateStoreForm() {
  const [state, action, pending] = useActionState(createStore, {});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  return (
    <form action={action} className="space-y-4" noValidate>
      <Alerts state={state} />
      <div>
        <Label htmlFor="name">Nome da loja</Label>
        <input
          id="name"
          name="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          aria-invalid={state.fieldErrors?.name ? true : undefined}
          aria-describedby="name-erro"
          className={`${input} h-11`}
        />
        <Err id="name-erro" state={state} name="name" />
      </div>
      <div>
        <Label htmlFor="slug" hint="aparece no link da loja">
          Endereço
        </Label>
        <div className="flex items-center rounded-xl border border-line bg-surface pl-3 text-sm text-muted focus-within:border-navy-2">
          zexi.com.br/loja/
          <input
            id="slug"
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            aria-invalid={state.fieldErrors?.slug ? true : undefined}
            aria-describedby="slug-erro"
            className="h-11 min-w-0 flex-1 rounded-r-xl bg-white px-2 text-base text-ink outline-none"
          />
        </div>
        <Err id="slug-erro" state={state} name="slug" />
      </div>
      <div>
        <Label htmlFor="description" hint="opcional">
          Sobre a loja
        </Label>
        <textarea id="description" name="description" rows={3} maxLength={600} className={`${input} py-2`} />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />} Abrir minha loja
      </Button>
    </form>
  );
}

export function StoreSettingsForm({ store }: { store: { name: string; description: string | null; origin_cep: string | null } }) {
  const [state, action, pending] = useActionState(updateStore, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <Alerts state={state} />
      <div>
        <Label htmlFor="name">Nome da loja</Label>
        <input id="name" name="name" defaultValue={store.name} className={`${input} h-11`} aria-describedby="name-erro" />
        <Err id="name-erro" state={state} name="name" />
      </div>
      <div>
        <Label htmlFor="description">Sobre a loja</Label>
        <textarea id="description" name="description" rows={4} maxLength={600} defaultValue={store.description ?? ""} className={`${input} py-2`} />
      </div>
      <div>
        <Label htmlFor="originCep" hint="de onde os pedidos saem">
          CEP de origem
        </Label>
        <input
          id="originCep"
          name="originCep"
          inputMode="numeric"
          maxLength={9}
          placeholder="00000-000"
          defaultValue={store.origin_cep ? store.origin_cep.replace(/(\d{5})(\d{3})/, "$1-$2") : ""}
          className={`${input} h-11 max-w-48`}
          aria-describedby="originCep-erro"
        />
        <Err id="originCep-erro" state={state} name="originCep" />
        <p className="mt-1 text-xs text-muted">Com o CEP, o frete (PAC e SEDEX) é calculado no checkout. Sem ele, o frete fica a combinar.</p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Salvar
      </Button>
    </form>
  );
}

type ProductValues = {
  id?: string;
  title?: string;
  description?: string | null;
  category_id?: number | null;
  condition?: "new" | "used" | "refurbished";
  price_cents?: number;
  compare_at_cents?: number | null;
  stock?: number;
  weight_grams?: number;
  status?: "draft" | "active" | "paused";
};

export function ProductForm({
  product,
  categories,
  aiEnabled = false,
}: {
  product?: ProductValues;
  categories: { id: number; name: string }[];
  aiEnabled?: boolean;
}) {
  const [state, action, pending] = useActionState(saveProduct, {});
  const f = (name: string) => ({
    id: name,
    name,
    "aria-invalid": state.fieldErrors?.[name] ? true : undefined,
    "aria-describedby": `${name}-erro`,
  });
  return (
    <form action={action} className="space-y-4" noValidate>
      {product?.id && <input type="hidden" name="id" value={product.id} />}
      <Alerts state={state} />
      <div>
        <Label htmlFor="title">Título</Label>
        <input {...f("title")} defaultValue={product?.title} maxLength={120} className={`${input} h-11`} />
        <Err id="title-erro" state={state} name="title" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="categoryId">Categoria</Label>
          <select {...f("categoryId")} defaultValue={product?.category_id ?? ""} className={`${input} h-11`}>
            <option value="" disabled>
              Escolha…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Err id="categoryId-erro" state={state} name="categoryId" />
        </div>
        <div>
          <Label htmlFor="condition">Condição</Label>
          <select {...f("condition")} defaultValue={product?.condition ?? "new"} className={`${input} h-11`}>
            <option value="new">Novo</option>
            <option value="used">Usado</option>
            <option value="refurbished">Recondicionado</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <Label htmlFor="price">Preço (R$)</Label>
          <input {...f("price")} inputMode="decimal" placeholder="199,90" defaultValue={centsToInput(product?.price_cents)} className={`${input} h-11`} />
          <Err id="price-erro" state={state} name="price" />
        </div>
        <div>
          <Label htmlFor="compareAt" hint="opcional">
            Preço anterior
          </Label>
          <input {...f("compareAt")} inputMode="decimal" placeholder="249,90" defaultValue={centsToInput(product?.compare_at_cents)} className={`${input} h-11`} />
          <Err id="compareAt-erro" state={state} name="compareAt" />
        </div>
        <div>
          <Label htmlFor="stock">Estoque</Label>
          <input {...f("stock")} type="number" min={0} max={100000} defaultValue={product?.stock ?? 1} className={`${input} h-11`} />
          <Err id="stock-erro" state={state} name="stock" />
        </div>
        <div>
          <Label htmlFor="weight" hint="com embalagem">
            Peso (g)
          </Label>
          <input {...f("weight")} type="number" min={1} max={30000} defaultValue={product?.weight_grams ?? 500} className={`${input} h-11`} />
          <Err id="weight-erro" state={state} name="weight" />
        </div>
      </div>
      <div>
        <Label htmlFor="description" hint="opcional">
          Descrição
        </Label>
        <textarea {...f("description")} rows={6} maxLength={5000} defaultValue={product?.description ?? ""} className={`${input} py-2`} />
        <div className="mt-2">
          <DescribeWithAI productId={product?.id} enabled={aiEnabled} />
        </div>
      </div>
      <div>
        <Label htmlFor="status">Situação</Label>
        <select {...f("status")} defaultValue={product?.status ?? "draft"} className={`${input} h-11 sm:w-60`}>
          <option value="draft">Rascunho (só você vê)</option>
          <option value="active">Ativo (à venda)</option>
          <option value="paused">Pausado</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {product?.id ? "Salvar produto" : "Criar produto"}
      </Button>
    </form>
  );
}

export function ImageUploadForm({ productId, remaining }: { productId: string; remaining: number }) {
  const [state, action, pending] = useActionState(uploadProductImages, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      <Alerts state={state} />
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-muted hover:border-navy-2">
        <Upload className="h-6 w-6 text-navy-2" aria-hidden="true" />
        <span>
          Escolha até {remaining} {remaining === 1 ? "foto" : "fotos"} (JPG, PNG ou WebP, até 5 MB cada)
        </span>
        <input type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple className="text-xs" />
      </label>
      <Button type="submit" variant="secondary" disabled={pending || remaining <= 0}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Enviar fotos
      </Button>
    </form>
  );
}
