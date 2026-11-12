import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Gavel, Info, Radio, ShieldCheck, ShoppingBag, Store as StoreIcon, Timer, Video } from "lucide-react";
import { AuctionCard, DemoTag, ProductCard, UpcomingCard } from "@/components/cards";
import { AuctionCardLive } from "@/components/auctions/auction-card";
import { MarketProductCard } from "@/components/market";
import { listAuctions } from "@/lib/auctions/queries";
import { ButtonLink } from "@/components/ui/button";
import { listProducts } from "@/lib/market/queries";
import { categories, endingSoon, liveAuctions, offers, stores, upcoming } from "@/lib/demo-data";
import { site } from "@/lib/site";

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

/** Os três jeitos de negociar, lado a lado, para não deixar dúvida. */
const modes = [
  {
    href: "/market",
    icon: ShoppingBag,
    name: "LIVELANCE MARKET",
    verb: "Compre agora",
    text: "Preço fixo, carrinho e entrega. Sem disputa.",
    iconClass: "bg-navy-soft text-navy",
    image: "/images/home/compre.webp",
    alt: "Tênis, fones, relógios e bolsas sobre fundo azul-marinho com sacolas vermelhas",
  },
  {
    href: "/ao-vivo",
    icon: Radio,
    name: "LIVELANCE LIVE",
    verb: "Assista e compre",
    text: "Vendedores apresentam ao vivo. Pergunte no chat e compre sem sair da transmissão.",
    iconClass: "bg-brand-soft text-brand",
    image: "/images/home/live.webp",
    alt: "Vendedor mostra uma bolsa para o celular durante uma transmissão ao vivo em uma loja",
  },
  {
    href: "/leiloes",
    icon: Gavel,
    name: "LIVELANCE LEILÕES",
    verb: "Dê seu lance",
    text: "Lotes com lance inicial, incremento mínimo e cronômetro oficial. Quem der o maior lance arremata.",
    iconClass: "bg-brand text-white",
    image: "/images/home/leilao.webp",
    alt: "Martelo de leilão ao lado de uma câmera antiga e relógios de colecionador",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-navy" aria-labelledby="hero-titulo">
        <div className="relative h-60 sm:h-80 md:absolute md:inset-0 md:-z-10 md:h-auto">
          <Image
            src="/images/home/hero.webp"
            alt="Vendedora sorridente mostra um tênis para o celular durante uma live de vendas"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[65%_20%] md:object-[70%_center]"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-navy via-transparent to-transparent md:bg-gradient-to-r md:from-navy md:via-navy/85 md:to-transparent"
            aria-hidden="true"
          />
        </div>
        <div className="mx-auto flex max-w-7xl flex-col px-4 pb-10 pt-2 md:min-h-[540px] md:justify-center md:pb-16 md:pt-16">
          <div className="max-w-xl text-white">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-white ring-1 ring-white/25 backdrop-blur-sm">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
              </span>
              MARKET · LIVE · LEILÕES
            </p>
            <h1 id="hero-titulo" className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Tudo acontece
              <br />
              <span className="text-brand-bright">ao vivo.</span>
            </h1>
            <p className="mt-4 max-w-lg text-base text-white/85 md:text-lg">
              Compre com preço fixo, assista vendedores apresentando ao vivo e dispute leilões com cronômetro oficial — tudo
              em uma plataforma brasileira.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/market" size="lg">
                Explorar ofertas <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/ao-vivo" size="lg" variant="outline" className="border-white/60 bg-white/10 text-white backdrop-blur-sm hover:bg-white hover:text-navy">
                <Radio className="h-5 w-5" aria-hidden="true" /> Ver lives
              </ButtonLink>
            </div>
            <p className="mt-5 text-sm font-semibold tracking-wide text-white/70">{site.tagline}</p>
          </div>
        </div>
        <p className="absolute right-3 top-2 text-[10px] text-white/70 md:bottom-2 md:top-auto">Imagem ilustrativa</p>
      </section>

      <section className="border-b border-line bg-surface" aria-label="Modalidades">
        <ul className="mx-auto grid max-w-7xl gap-4 px-4 py-8 md:grid-cols-3 md:py-10">
          {modes.map((m) => (
            <li key={m.href}>
              <Link
                href={m.href}
                className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white text-ink shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg"
              >
                <span className="relative block aspect-[2/1] overflow-hidden bg-navy-soft md:aspect-[16/9]">
                  <Image
                    src={m.image}
                    alt={m.alt}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
                  />
                  <span className={`absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl shadow ${m.iconClass}`}>
                    <m.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                </span>
                <span className="flex flex-1 flex-col p-4">
                  <span className="block text-[11px] font-bold tracking-wider text-brand">{m.name}</span>
                  <span className="flex items-center gap-1 font-display text-lg font-bold text-navy">
                    {m.verb}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{m.text}</span>
                </span>
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
