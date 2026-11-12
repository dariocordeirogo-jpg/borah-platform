import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Gavel, Info, Radio, ShieldCheck, ShoppingBag, Store as StoreIcon, Tag, Timer, UserRound, Video } from "lucide-react";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { AuctionCard, DemoTag, ProductCard, UpcomingCard } from "@/components/cards";
import { AuctionCardLive } from "@/components/auctions/auction-card";
import { MarketProductCard } from "@/components/market";
import { listAuctions } from "@/lib/auctions/queries";
import { ButtonLink } from "@/components/ui/button";
import { listProducts } from "@/lib/market/queries";
import { categories, endingSoon, liveAuctions, offers, stores, upcoming } from "@/lib/demo-data";

function SectionHeader({
  title,
  subtitle,
  href,
  cta,
  badge,
}: {
  title: string;
  subtitle?: string;
  href: string;
  cta: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {badge}
        <h2 className="font-display text-xl font-bold tracking-tight text-navy md:text-2xl">{title}</h2>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand hover:text-brand-dark hover:underline">
        {cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

/** Leilões reais em andamento; enquanto não houver nenhum, mostra a vitrine de demonstração. */
async function LiveAuctions() {
  const { items, serverNow } = await listAuctions("andamento", 8);
  if (!items.length) {
    return (
      <Rail>
        {endingSoon.map((a) => (
          <AuctionCard key={a.id} auction={a} />
        ))}
      </Rail>
    );
  }
  return (
    <Rail>
      {items.map((a) => (
        <AuctionCardLive key={a.id} a={a} serverNow={serverNow} />
      ))}
    </Rail>
  );
}

async function ScheduledAuctions() {
  const { items, serverNow } = await listAuctions("programados", 6);
  if (!items.length) {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {upcoming.map((u) => (
          <UpcomingCard key={u.id} item={u} />
        ))}
      </div>
    );
  }
  return (
    <Rail>
      {items.map((a) => (
        <AuctionCardLive key={a.id} a={a} serverNow={serverNow} />
      ))}
    </Rail>
  );
}

/** Produtos reais do Market; enquanto não houver nenhum, mostra a vitrine de demonstração. */
async function FeaturedProducts() {
  const { items } = await listProducts({ limit: 10 });
  if (!items.length) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {offers.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {items.map((p) => (
        <li key={p.id}>
          <MarketProductCard product={p} />
        </li>
      ))}
    </ul>
  );
}

/** No celular vira carrossel deslizante; do tablet em diante, grade. */
function Rail({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 [&>*]:w-[78%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto">
      {children}
    </div>
  );
}

/** Atalhos logo abaixo do carrossel: os três jeitos de negociar e os caminhos mais procurados. */
const shortcuts = [
  { href: "/market", icon: ShoppingBag, title: "Compre agora", text: "Preço fixo e entrega pelos Correios.", cta: "Ver produtos", iconClass: "bg-navy-soft text-navy" },
  { href: "/ao-vivo", icon: Radio, title: "Assista e compre", text: "Lojas mostrando produtos ao vivo.", cta: "Ver lives", iconClass: "bg-brand-soft text-brand" },
  { href: "/leiloes", icon: Gavel, title: "Dê seu lance", text: "Leilões com cronômetro oficial.", cta: "Ver leilões", iconClass: "bg-brand text-white" },
  { href: "/market?preco_max=100", icon: Tag, title: "Até R$ 100", text: "Achados que cabem no bolso.", cta: "Ver achados", iconClass: "bg-navy-soft text-navy" },
  { href: "/conta", icon: UserRound, title: "Entre na sua conta", text: "Acompanhe pedidos e lances.", cta: "Entrar", iconClass: "bg-brand-soft text-brand" },
  { href: "/vender", icon: StoreIcon, title: "Venda na LIVELANCE", text: "Abra sua loja e venda ao vivo.", cta: "Começar a vender", iconClass: "bg-navy text-white" },
];

export default function HomePage() {
  return (
    <>
      <HeroCarousel />

      <section aria-label="Atalhos" className="relative z-30 -mt-16 md:-mt-20">
        <ul className="mx-auto flex max-w-7xl snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-6">
          {shortcuts.map((s) => (
            <li key={s.title} className="w-[44%] shrink-0 snap-start sm:w-[30%] md:w-auto">
              <Link
                href={s.href}
                className="group flex h-full flex-col items-center rounded-[var(--radius-card)] bg-white p-4 text-center shadow-[0_6px_24px_rgba(16,36,58,0.12)] ring-1 ring-line transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(16,36,58,0.18)]"
              >
                <span className="text-sm font-bold text-navy md:text-base">{s.title}</span>
                <span className={`my-3 flex h-16 w-16 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110 ${s.iconClass}`}>
                  <s.icon className="h-8 w-8" aria-hidden="true" />
                </span>
                <span className="text-xs text-muted md:text-sm">{s.text}</span>
                <span className="mt-auto pt-3 text-sm font-semibold text-brand group-hover:underline">{s.cta}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="border-b border-line bg-white">
        <p className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2.5 text-xs text-muted md:items-center md:text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-navy-2 md:mt-0" aria-hidden="true" />
          Versão de desenvolvimento: lives, leilões, produtos, lojas e preços desta página são demonstrações. Nenhum
          lance, transmissão ou pagamento é real.
        </p>
      </div>

      <div className="mx-auto max-w-7xl space-y-12 px-4 py-8 md:py-12">
        <section aria-labelledby="categorias">
          <h2 id="categorias" className="sr-only">
            Categorias
          </h2>
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-12 md:px-0">
            {categories.map((c) => (
              <li key={c.slug} className="shrink-0">
                <Link href={`/market?categoria=${c.slug}`} className="flex w-20 flex-col items-center gap-2 text-center md:w-auto">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand transition-colors hover:bg-brand hover:text-white">
                    <c.icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-medium">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionHeader
            badge={
              <span className="mb-1 inline-flex items-center gap-1.5 text-xs font-bold text-brand">
                <Radio className="h-3.5 w-3.5" aria-hidden="true" /> LIVELANCE LIVE
              </span>
            }
            title="Transmissões ao vivo"
            subtitle="Vendedores apresentando produtos agora"
            href="/ao-vivo"
            cta="Ver lives"
          />
          <Rail>
            {liveAuctions.map((a) => (
              <AuctionCard key={a.id} auction={a} />
            ))}
          </Rail>
        </section>

        <section>
          <SectionHeader
            badge={
              <span className="mb-1 inline-flex items-center gap-1.5 text-xs font-bold text-brand">
                <Gavel className="h-3.5 w-3.5" aria-hidden="true" /> LIVELANCE LEILÕES
              </span>
            }
            title="Leilões em andamento"
            subtitle="Terminando em breve: última chance de dar seu lance"
            href="/leiloes"
            cta="Todos os leilões"
          />
          <Suspense fallback={<div className="h-80 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
            <LiveAuctions />
          </Suspense>
        </section>

        <section>
          <SectionHeader
            badge={
              <span className="mb-1 inline-flex items-center gap-1.5 text-xs font-bold text-brand">
                <Timer className="h-3.5 w-3.5" aria-hidden="true" /> AGENDA
              </span>
            }
            title="Próximos leilões"
            subtitle="Lotes que abrem em breve"
            href="/leiloes"
            cta="Ver agenda"
          />
          <Suspense fallback={<div className="h-40 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
            <ScheduledAuctions />
          </Suspense>
        </section>

        <section>
          <SectionHeader
            badge={
              <span className="mb-1 inline-flex items-center gap-1.5 text-xs font-bold text-brand">
                <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" /> LIVELANCE MARKET
              </span>
            }
            title="Produtos em destaque e ofertas"
            subtitle="Compra imediata, sem disputa"
            href="/market"
            cta="Ir ao Market"
          />
          <Suspense fallback={<div className="h-72 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
            <FeaturedProducts />
          </Suspense>
        </section>

        <section>
          <SectionHeader title="Lojas em destaque" href="/market" cta="Ver lojas" />
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {stores.map((s) => (
              <li key={s.id}>
                <Link href="/market" className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-white p-3 hover:border-brand">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <s.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{s.name}</span>
                    <span className="block truncate text-xs text-muted">{s.tagline}</span>
                    <DemoTag className="mt-1 inline-block" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="vendedores"
          className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)] md:grid md:grid-cols-[1.3fr_1fr]"
        >
          <div className="p-6 md:p-10">
            <p className="text-xs font-bold tracking-wider text-brand">LIVELANCE SELLER</p>
            <h2 id="vendedores" className="mt-2 font-display text-2xl font-extrabold tracking-tight text-navy md:text-3xl">
              Venda do seu jeito: vitrine, live ou leilão.
            </h2>
            <p className="mt-3 max-w-lg text-muted">
              Cadastre seus produtos uma vez e escolha como vender: preço fixo no Market, apresentação ao vivo ou lote em
              leilão.
            </p>
            <ButtonLink href="/vender" size="lg" className="mt-6">
              Quero vender na LIVELANCE <ArrowRight className="h-5 w-5" aria-hidden="true" />
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
