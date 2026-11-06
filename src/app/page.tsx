import Link from "next/link";
import { ArrowRight, Eye, Gavel, Info, Megaphone, ShoppingBag, Store as StoreIcon, Wallet } from "lucide-react";
import { AuctionCard, DemoTag, ProductCard, UpcomingCard } from "@/components/cards";
import { ButtonLink } from "@/components/ui/button";
import { categories, endingSoon, liveAuctions, offers, stores, upcoming } from "@/lib/demo-data";

function SectionHeader({ title, subtitle, href, cta }: { title: string; subtitle?: string; href: string; cta: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight md:text-2xl">{title}</h2>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-green-deep hover:underline">
        {cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
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

const pillars = [
  { icon: Eye, title: "Assista", text: "Lives e vídeos com produtos que você compra sem sair do conteúdo." },
  { icon: ShoppingBag, title: "Compre", text: "Dê lances nos leilões ou compre na hora no Market." },
  { icon: StoreIcon, title: "Venda", text: "Abra sua loja, faça leilões e transmita ao vivo." },
  { icon: Wallet, title: "Ganhe", text: "Indique produtos e receba comissão pelas vendas atribuídas a você." },
];

export default function HomePage() {
  return (
    <>
      {/* Destaque principal: BORAH LANCES */}
      <section className="metal-green text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1.1fr_1fr] md:items-center md:py-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide">
              <Gavel className="h-4 w-4" aria-hidden="true" /> BORAH LANCES
            </p>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Não fique só olhando.
              <br />
              <span className="text-gold-light">Entre na disputa.</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-white/90 md:text-lg">
              Leilões ao vivo e programados, de vendedores verificados, com regras claras e cronômetro oficial.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/lances" variant="gold" size="lg">
                Ver leilões <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/vender" variant="light" size="lg">
                Quero vender
              </ButtonLink>
            </div>
            <p className="mt-6 text-sm font-semibold tracking-wide text-white/80">Assista. Compre. Venda. Ganhe.</p>
          </div>
          <div className="ml-auto hidden w-full max-w-sm md:block">
            <AuctionCard auction={liveAuctions[0]} />
          </div>
        </div>
      </section>

      <div className="border-b border-line bg-gold-soft">
        <p className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2.5 text-xs text-ink md:items-center md:text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold-ink md:mt-0" aria-hidden="true" />
          Versão de desenvolvimento: todos os leilões, produtos, lojas e preços desta página são demonstrações.
          Os leilões reais chegam na Fase 3.
        </p>
      </div>

      <div className="mx-auto max-w-7xl space-y-12 px-4 py-8 md:py-12">
        {/* Categorias */}
        <section aria-labelledby="categorias">
          <h2 id="categorias" className="sr-only">
            Categorias
          </h2>
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-12 md:px-0">
            {categories.map((c) => (
              <li key={c.slug} className="shrink-0">
                <Link href={`/market?categoria=${c.slug}`} className="flex w-20 flex-col items-center gap-2 text-center md:w-auto">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-soft text-green transition-colors hover:bg-green hover:text-white">
                    <c.icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-medium">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionHeader title="Ao vivo agora" subtitle="Leilões acontecendo durante transmissões" href="/ao-vivo" cta="Ver lives" />
          <Rail>
            {liveAuctions.map((a) => (
              <AuctionCard key={a.id} auction={a} />
            ))}
          </Rail>
        </section>

        <section>
          <SectionHeader title="Terminando em breve" subtitle="Última chance de dar seu lance" href="/lances" cta="Todos os leilões" />
          <Rail>
            {endingSoon.map((a) => (
              <AuctionCard key={a.id} auction={a} />
            ))}
          </Rail>
        </section>

        <section>
          <SectionHeader title="Próximos leilões" subtitle="Ative o lembrete e não perca a abertura" href="/lances" cta="Agenda" />
          <div className="grid gap-3 md:grid-cols-3">
            {upcoming.map((u) => (
              <UpcomingCard key={u.id} item={u} />
            ))}
          </div>
        </section>

        <section>
          <SectionHeader title="Compre agora" subtitle="Ofertas do Market, sem disputa" href="/market" cta="Ir ao Market" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {offers.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        <section>
          <SectionHeader title="Lojas em destaque" href="/market" cta="Ver lojas" />
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {stores.map((s) => (
              <li key={s.id}>
                <Link href="/market" className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-white p-3 hover:border-green">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full metal-green text-white">
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

        <section aria-labelledby="como-funciona" className="rounded-[var(--radius-card)] bg-surface p-6 md:p-10">
          <h2 id="como-funciona" className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">
            Assista. Compre. Venda. <span className="text-gold-ink">Ganhe.</span>
          </h2>
          <p className="mt-1 text-muted">Uma conta, todas as possibilidades.</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((p) => (
              <li key={p.title} className="rounded-xl bg-white p-5">
                <p.icon className="h-7 w-7 text-green" aria-hidden="true" />
                <h3 className="mt-3 font-display text-lg font-bold">{p.title}</h3>
                <p className="mt-1 text-sm text-muted">{p.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col items-start gap-4 rounded-[var(--radius-card)] metal-gold p-6 text-ink md:flex-row md:items-center md:justify-between md:p-8">
          <div className="flex items-start gap-3">
            <Megaphone className="h-8 w-8 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="font-display text-xl font-extrabold md:text-2xl">BORAH INDICA</h2>
              <p className="text-sm md:text-base">
                Divulgue produtos e receba comissão pelas vendas atribuídas a você, conforme as regras do programa.
              </p>
            </div>
          </div>
          <ButtonLink href="/indique" className="bg-ink text-white hover:bg-black">
            Conhecer o programa
          </ButtonLink>
        </section>
      </div>
    </>
  );
}
