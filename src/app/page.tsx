import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Gavel, Info, Radio, ShieldCheck, ShoppingBag, Store as StoreIcon, Tag, UserRound, Video } from "lucide-react";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { AuctionCard, DemoLiveCard, DemoTag, ProductCard, UpcomingCard } from "@/components/cards";
import { AuctionCardLive } from "@/components/auctions/auction-card";
import { LiveCard, Shelf } from "@/components/listing";
import { MarketProductCard } from "@/components/market";
import { ButtonLink } from "@/components/ui/button";
import { listAuctions } from "@/lib/auctions/queries";
import { listLives } from "@/lib/live/queries";
import { listProducts } from "@/lib/market/queries";
import { categories, demoLives, endingSoon, liveAuctions, offers, stores, upcoming } from "@/lib/demo-data";

const eyebrow = (Icon: typeof Radio, text: string) => (
  <span className="mb-0.5 inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-brand">
    <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {text}
  </span>
);

/** Vitrine com poucos itens reais é completada com demonstração (sempre marcada) até este mínimo. */
const MIN_SHELF = 5;
const fill = <T,>(realCount: number, demo: T[]) => (realCount >= MIN_SHELF ? [] : demo.slice(0, MIN_SHELF - realCount));

const whenBR = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function ShelfSkeleton({ live = false }: { live?: boolean }) {
  return (
    <div className="rounded-xl bg-white p-4 md:p-5">
      <div className="mb-3 h-6 w-48 animate-pulse rounded bg-surface-2" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: live ? 3 : 5 }).map((_, i) => (
          <div key={i} className={`${live ? "aspect-video w-[82%] sm:w-[48%] lg:w-[32%]" : "aspect-[3/5] w-[44%] sm:w-[31%] md:w-[23.5%] lg:w-[18.8%]"} shrink-0 animate-pulse rounded-lg bg-surface`} />
        ))}
      </div>
    </div>
  );
}

/** Lives reais no ar (ou programadas); sem nenhuma, mostra a vitrine de demonstração. */
async function LivesShelf() {
  const { live, upcoming: next } = await listLives();
  const real = [...live.map((l) => ({ l, on: true })), ...next.map((l) => ({ l, on: false }))].slice(0, 8);
  return (
    <Shelf title="Transmissões ao vivo" eyebrow={eyebrow(Radio, "ZEXI LIVE")} href="/ao-vivo" cta="Ver lives" size="live">
      {real.map(({ l, on }) => (
        <li key={l.id}>
          <LiveCard href={`/live/${l.id}`} title={l.title} store={l.stores?.name} live={on} when={on ? undefined : whenBR(l.scheduled_at)} auction={(l.auctions ?? []).some((a) => a.status === "active")} />
        </li>
      ))}
      {(real.length ? [] : demoLives).map((l) => (
        <li key={l.id}>
          <DemoLiveCard live={l} />
        </li>
      ))}
    </Shelf>
  );
}

/** Leilões reais em andamento; sem nenhum, a vitrine de demonstração. */
async function AuctionsShelf() {
  const { items, serverNow } = await listAuctions("andamento", 10);
  return (
    <Shelf title="Leilões terminando" eyebrow={eyebrow(Gavel, "ZEXI LEILÕES")} href="/leiloes" cta="Ver leilões">
      {items.map((a) => (
        <li key={a.id}>
          <AuctionCardLive a={a} serverNow={serverNow} />
        </li>
      ))}
      {fill(items.length, [...liveAuctions, ...endingSoon]).map((a) => (
        <li key={a.id}>
          <AuctionCard auction={a} />
        </li>
      ))}
    </Shelf>
  );
}

async function ScheduledShelf() {
  const { items, serverNow } = await listAuctions("programados", 10);
  return (
    <Shelf title="Próximos leilões" href="/leiloes?aba=programados" cta="Ver agenda">
      {items.map((a) => (
        <li key={a.id}>
          <AuctionCardLive a={a} serverNow={serverNow} />
        </li>
      ))}
      {fill(items.length, upcoming).map((u) => (
        <li key={u.id}>
          <UpcomingCard item={u} />
        </li>
      ))}
    </Shelf>
  );
}

/** Produtos reais do Market; sem nenhum, a vitrine de demonstração. */
async function ProductsShelf() {
  const { items } = await listProducts({ limit: 12 });
  return (
    <Shelf title="Ofertas do Market" eyebrow={eyebrow(ShoppingBag, "ZEXI MARKET")} href="/market" cta="Ver todas">
      {items.map((p) => (
        <li key={p.id}>
          <MarketProductCard product={p} />
        </li>
      ))}
      {fill(items.length, offers).map((p) => (
        <li key={p.id}>
          <ProductCard product={p} />
        </li>
      ))}
    </Shelf>
  );
}

/** Atalhos logo abaixo do carrossel: os três jeitos de negociar e os caminhos mais procurados. */
const shortcuts = [
  { href: "/market", icon: ShoppingBag, title: "Compre agora", hint: "Preço fixo" },
  { href: "/ao-vivo", icon: Radio, title: "Ao vivo", hint: "Assista e compre" },
  { href: "/leiloes", icon: Gavel, title: "Leilões", hint: "Dê seu lance" },
  { href: "/market?preco_max=100", icon: Tag, title: "Até R$ 100", hint: "Achados" },
  { href: "/conta", icon: UserRound, title: "Minha conta", hint: "Pedidos e lances" },
  { href: "/vender", icon: StoreIcon, title: "Venda na Zexi", hint: "Abra sua loja" },
];

export default function HomePage() {
  return (
    <>
      <HeroCarousel />

      <section aria-label="Atalhos" className="relative z-30 mx-auto -mt-10 max-w-7xl px-4 md:-mt-14">
        <ul className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-6">
          {shortcuts.map((s) => (
            <li key={s.title}>
              <Link
                href={s.href}
                className="group flex h-full flex-col items-center gap-1.5 rounded-xl bg-white px-2 py-3 text-center shadow-[0_2px_10px_rgba(15,17,21,0.10)] transition-shadow hover:shadow-[0_6px_20px_rgba(15,17,21,0.16)] md:py-4"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-white md:h-12 md:w-12">
                  <s.icon className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true" />
                </span>
                <span className="text-xs font-semibold leading-tight text-navy sm:text-sm">{s.title}</span>
                <span className="sr-only text-xs text-muted sm:not-sr-only sm:block">{s.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 md:space-y-5 md:py-6">
        <p className="flex items-start gap-2 rounded-lg bg-navy-soft px-3 py-2 text-xs text-navy-2 md:items-center">
          <Info className="mt-0.5 h-4 w-4 shrink-0 md:mt-0" aria-hidden="true" />
          Versão de testes: itens marcados como “Demonstração” não são reais. Nenhum lance, transmissão ou pagamento
          desta vitrine é real.
        </p>

        <section aria-labelledby="categorias" className="rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(15,17,21,0.08)] md:p-5">
          <h2 id="categorias" className="mb-3 font-display text-lg font-bold tracking-tight text-navy md:text-xl">
            Categorias
          </h2>
          <ul className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-6 md:gap-2 md:px-0 lg:grid-cols-12">
            {categories.map((c) => (
              <li key={c.slug} className="shrink-0">
                <Link
                  href={`/market?categoria=${c.slug}`}
                  className="flex w-[4.75rem] flex-col items-center gap-1.5 rounded-lg p-1.5 text-center hover:bg-surface md:w-auto"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-navy">
                    <c.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs leading-tight text-ink">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <Suspense fallback={<ShelfSkeleton live />}>
          <LivesShelf />
        </Suspense>
        <Suspense fallback={<ShelfSkeleton />}>
          <AuctionsShelf />
        </Suspense>
        <Suspense fallback={<ShelfSkeleton />}>
          <ProductsShelf />
        </Suspense>
        <Suspense fallback={<ShelfSkeleton />}>
          <ScheduledShelf />
        </Suspense>

        <Shelf title="Lojas em destaque" href="/market" cta="Ver lojas" track={false}>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {stores.map((s) => (
              <li key={s.id}>
                <Link href="/market" className="flex items-center gap-3 rounded-lg border border-line p-3 hover:border-brand">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <s.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy">{s.name}</span>
                    <span className="block truncate text-xs text-muted">{s.tagline}</span>
                  </span>
                  <DemoTag className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </Shelf>

        <section
          aria-labelledby="vendedores"
          className="overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(15,17,21,0.08)] md:grid md:grid-cols-[1.3fr_1fr]"
        >
          <div className="p-5 md:p-10">
            <p className="text-xs font-bold tracking-wider text-brand">ZEXI SELLER</p>
            <h2 id="vendedores" className="mt-2 font-display text-2xl font-extrabold tracking-tight text-navy md:text-3xl">
              Venda do seu jeito: vitrine, live ou leilão.
            </h2>
            <p className="mt-3 max-w-lg text-muted">
              Cadastre seus produtos uma vez e escolha como vender: preço fixo no Market, apresentação ao vivo ou lote em
              leilão.
            </p>
            <ButtonLink href="/vender" size="lg" className="mt-6 w-full sm:w-auto">
              Quero vender na Zexi <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </ButtonLink>
          </div>
          <ul className="grid gap-px border-t border-line bg-line md:border-l md:border-t-0">
            {[
              { icon: StoreIcon, title: "Sua loja", text: "Produtos, estoque e pedidos em um painel." },
              { icon: Video, title: "Suas lives", text: "Transmita, fixe produtos e converse com quem assiste." },
              { icon: ShieldCheck, title: "Leilões com regra clara", text: "Lance validado pelo servidor e histórico público." },
            ].map((f) => (
              <li key={f.title} className="flex items-start gap-3 bg-surface p-5">
                <f.icon className="h-6 w-6 shrink-0 text-brand" aria-hidden="true" />
                <span>
                  <span className="block font-semibold text-navy">{f.title}</span>
                  <span className="block text-sm text-muted">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
