import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ExternalLink, ImageIcon, Palette, Star, Trash2 } from "lucide-react";
import { ContactWarning } from "@/components/contact-warning";
import { Notice } from "@/components/market";
import { StoreSettingsForm } from "@/components/seller-forms";
import { Button } from "@/components/ui/button";
import { getSellerProducts } from "@/lib/market/queries";
import { requireStore } from "@/lib/market/seller-guard";
import { addBanner, deleteBanner, removeStoreImage, saveAppearance, saveFeatured, uploadStoreImage } from "@/lib/stores/actions";
import { MAX_BANNERS, MAX_FEATURED, STORE_THEMES, storeMediaUrl } from "@/lib/stores/format";
import { getMyStoreMedia } from "@/lib/stores/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Minha loja" };
type SP = { ok?: string; erro?: string; contato?: string };

const okText: Record<string, string> = {
  aparencia: "Aparência salva.",
  logo: "Logo atualizado.",
  cover: "Capa atualizada.",
  removida: "Imagem removida.",
  banner: "Banner publicado.",
  "banner-apagado": "Banner apagado.",
  destaques: "Destaques salvos.",
};
const card = "rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]";
const fileInput = "block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:font-semibold file:text-brand-dark";

async function Settings({ searchParams }: { searchParams: Promise<SP> }) {
  const [store, sp] = await Promise.all([requireStore("/seller/loja"), searchParams]);
  const [{ banners, featuredIds }, products] = await Promise.all([getMyStoreMedia(store.id), getSellerProducts(store.id)]);
  const active = products.filter((p) => p.status === "active");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Minha loja</h1>
        <Link href={`/loja/${store.slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
          Ver como os clientes veem <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
      {sp.ok && okText[sp.ok] && <Notice tone="success">{okText[sp.ok]}</Notice>}
      {sp.contato && <ContactWarning />}
      {sp.erro && <Notice tone="error">{sp.erro}</Notice>}

      <section className={card} aria-label="Dados da loja">
        <p className="mb-4 text-sm text-muted">
          Endereço da loja: <span className="font-medium text-navy">zexi.com.br/loja/{store.slug}</span> (não pode ser alterado)
        </p>
        <StoreSettingsForm store={store} />
      </section>

      <section id="aparencia" className={cn(card, "space-y-5")} aria-label="Aparência da loja">
        <h2 className="flex items-center gap-2 font-semibold text-navy">
          <Palette className="h-5 w-5 text-brand" aria-hidden="true" /> Aparência da página
        </h2>
        <p className="text-sm text-muted">
          Deixe a página com a cara da sua marca. Por regra, não coloque telefone, e-mail, site ou redes sociais nos textos nem nas imagens:
          textos com contato são ocultados automaticamente e imagens com contato podem ser removidas pela moderação.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {(["logo", "cover"] as const).map((kind) => {
            const path = kind === "logo" ? store.logo_path : store.cover_path;
            return (
              <div key={kind} className="space-y-2 rounded-xl border border-line p-3">
                <p className="text-sm font-semibold text-navy">{kind === "logo" ? "Logo (quadrado)" : "Capa (1600 × 400)"}</p>
                {path ? (
                  <Image
                    src={storeMediaUrl(path)}
                    alt={kind === "logo" ? "Logo atual" : "Capa atual"}
                    width={kind === "logo" ? 96 : 400}
                    height={kind === "logo" ? 96 : 100}
                    className={cn("rounded-lg border border-line object-cover", kind === "logo" ? "h-24 w-24" : "h-24 w-full")}
                    unoptimized
                  />
                ) : (
                  <span className="flex h-24 items-center justify-center rounded-lg bg-surface text-muted">
                    <ImageIcon className="h-6 w-6" aria-hidden="true" />
                  </span>
                )}
                <form action={uploadStoreImage} className="space-y-2">
                  <input type="hidden" name="kind" value={kind} />
                  <label className="sr-only" htmlFor={`img-${kind}`}>
                    {kind === "logo" ? "Arquivo do logo" : "Arquivo da capa"}
                  </label>
                  <input id={`img-${kind}`} name="image" type="file" accept="image/jpeg,image/png,image/webp" required className={fileInput} />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">
                      {kind === "logo" ? "Enviar logo" : "Enviar capa"}
                    </Button>
                  </div>
                </form>
                {path && (
                  <form action={removeStoreImage}>
                    <input type="hidden" name="kind" value={kind} />
                    <Button type="submit" size="sm" variant="outline">
                      Remover
                    </Button>
                  </form>
                )}
              </div>
            );
          })}
        </div>

        <form action={saveAppearance} className="space-y-3">
          <fieldset>
            <legend className="text-sm font-semibold text-navy">Cor da página</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(STORE_THEMES).map(([key, t]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm has-[:checked]:border-navy has-[:checked]:font-semibold">
                  <input type="radio" name="theme" value={key} defaultChecked={store.theme === key} className="sr-only" />
                  <span className={cn("h-4 w-4 rounded-full", t.bg)} aria-hidden="true" />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-semibold text-navy" htmlFor="tagline">
            Frase de apresentação <span className="font-normal text-muted">(até 120 caracteres)</span>
          </label>
          <input
            id="tagline"
            name="tagline"
            maxLength={120}
            defaultValue={store.tagline ?? ""}
            placeholder="Ex.: Peças originais com garantia e envio no mesmo dia"
            className="h-11 w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-navy-2"
          />
          <Button type="submit">Salvar aparência</Button>
        </form>
      </section>

      <section className={cn(card, "space-y-4")} aria-label="Banners da loja">
        <h2 className="flex items-center gap-2 font-semibold text-navy">
          <ImageIcon className="h-5 w-5 text-brand" aria-hidden="true" /> Banners ({banners.length} de {MAX_BANNERS})
        </h2>
        <p className="text-sm text-muted">Aparecem em carrossel no topo da sua página. Tamanho recomendado: 1200 × 400.</p>
        {banners.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2" aria-label="Seus banners">
            {banners.map((b) => (
              <li key={b.id} className="space-y-2 rounded-xl border border-line p-2" data-testid="banner-loja">
                <Image src={b.imageUrl} alt={b.title ?? "Banner"} width={400} height={133} className="h-28 w-full rounded-lg object-cover" unoptimized />
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-ink">{b.title ?? "Sem título"}</span>
                  <form action={deleteBanner}>
                    <input type="hidden" name="bannerId" value={b.id} />
                    <Button type="submit" size="sm" variant="outline" aria-label={`Apagar banner ${b.title ?? ""}`}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        {banners.length < MAX_BANNERS && (
          <form action={addBanner} className="grid gap-3 rounded-xl border border-dashed border-line p-3 sm:grid-cols-2" aria-label="Novo banner">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-navy" htmlFor="banner-img">
                Imagem do banner
              </label>
              <input id="banner-img" name="image" type="file" accept="image/jpeg,image/png,image/webp" required className={cn(fileInput, "mt-1")} />
            </div>
            <label className="text-sm font-medium text-navy">
              Título (opcional)
              <input name="title" maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-navy-2" />
            </label>
            <label className="text-sm font-medium text-navy">
              Ao clicar, abrir
              <select name="productId" className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3 text-base">
                <option value="">Só a imagem</option>
                {active.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2">
              <Button type="submit">Publicar banner</Button>
            </div>
          </form>
        )}
      </section>

      <section className={cn(card, "space-y-4")} aria-label="Produtos em destaque">
        <h2 className="flex items-center gap-2 font-semibold text-navy">
          <Star className="h-5 w-5 text-brand" aria-hidden="true" /> Produtos em destaque (até {MAX_FEATURED})
        </h2>
        {active.length ? (
          <form action={saveFeatured} className="space-y-3">
            <ul className="grid max-h-80 gap-1 overflow-y-auto sm:grid-cols-2">
              {active.map((p) => (
                <li key={p.id}>
                  <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface">
                    <input type="checkbox" name="productId" value={p.id} defaultChecked={featuredIds.includes(p.id)} className="h-4 w-4 accent-brand" />
                    <span className="truncate">{p.title}</span>
                  </label>
                </li>
              ))}
            </ul>
            <Button type="submit">Salvar destaques</Button>
          </form>
        ) : (
          <p className="text-sm text-muted">Ative um anúncio para escolher os destaques.</p>
        )}
      </section>
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/seller/loja">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
      <Settings searchParams={searchParams as Promise<SP>} />
    </Suspense>
  );
}
