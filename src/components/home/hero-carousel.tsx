"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Slide = {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  text: string;
  cta: { href: string; label: string };
  image: string;
  alt: string;
  /** Fundo do slide (cores da marca) */
  bg: string;
  ctaClass: string;
};

const slides: Slide[] = [
  {
    id: "ao-vivo",
    eyebrow: "MARKET · LIVE · LEILÕES",
    title: (
      <>
        Tudo acontece <span className="text-brand-bright">ao vivo.</span>
      </>
    ),
    text: "Compre, assista e dê seu lance em um só lugar.",
    cta: { href: "/market", label: "Explorar ofertas" },
    image: "/images/home/hero.webp",
    alt: "Vendedora sorridente mostra um tênis para o celular durante uma live de vendas",
    bg: "bg-navy",
    ctaClass: "bg-brand text-white hover:bg-brand-dark",
  },
  {
    id: "lives",
    eyebrow: "ZEXI LIVE",
    title: "Viu na live, comprou na hora.",
    text: "Lojas apresentam produtos ao vivo. Pergunte no chat e compre sem sair da transmissão.",
    cta: { href: "/ao-vivo", label: "Ver lives" },
    image: "/images/home/live.webp",
    alt: "Vendedor mostra uma bolsa para o celular durante uma transmissão ao vivo",
    bg: "bg-brand",
    ctaClass: "bg-white text-brand hover:bg-brand-soft",
  },
  {
    id: "leiloes",
    eyebrow: "ZEXI LEILÕES",
    title: "Cada lance conta.",
    text: "Lances em tempo real e cronômetro oficial. Quem der o maior lance arremata.",
    cta: { href: "/leiloes", label: "Ver leilões" },
    image: "/images/home/leilao.webp",
    alt: "Martelo de leilão ao lado de uma câmera antiga e relógios de colecionador",
    bg: "bg-gradient-to-br from-navy via-navy-2 to-brand-dark",
    ctaClass: "bg-white text-navy hover:bg-navy-soft",
  },
  {
    id: "cupons",
    eyebrow: "CUPONS DAS LOJAS",
    title: "Tem cupom? Tem desconto.",
    text: "Lojas criam cupons exclusivos. É só digitar o código ao finalizar a compra.",
    cta: { href: "/market", label: "Ver ofertas" },
    image: "/images/home/compre.webp",
    alt: "Tênis, fones, relógios e bolsas sobre fundo azul-marinho com sacolas vermelhas",
    bg: "bg-gradient-to-br from-brand to-brand-dark",
    ctaClass: "bg-white text-brand hover:bg-brand-soft",
  },
];

const INTERVAL_MS = 6000;

/** Carrossel de banners da home: troca sozinho (pausa ao passar o mouse, focar ou com movimento reduzido). */
export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);

  const go = useCallback((i: number) => setIndex((i + slides.length) % slides.length), []);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (paused || reduced.current) return;
    const t = setTimeout(() => go(index + 1), INTERVAL_MS);
    return () => clearTimeout(t);
  }, [index, paused, go]);

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques da Zexi"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <h1 className="sr-only">Zexi: Tudo acontece ao vivo. Marketplace, vendas ao vivo e leilões online.</h1>
      <div className="relative grid">
        {slides.map((s, i) => {
          const active = i === index;
          return (
            <div
              key={s.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${slides.length}`}
              aria-hidden={!active}
              inert={!active}
              data-testid={`slide-${s.id}`}
              className={cn(
                "col-start-1 row-start-1 transition-opacity duration-500 motion-reduce:transition-none",
                s.bg,
                active ? "z-10 opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <div className="mx-auto grid max-w-7xl items-center gap-5 px-4 pb-24 pt-5 md:grid-cols-[1fr_1.1fr] md:gap-10 md:pb-28 md:pt-10">
                <div className="relative order-1 aspect-[16/9] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/20 md:order-2 md:aspect-[4/3] lg:aspect-[16/10]">
                  <Image src={s.image} alt={s.alt} fill priority={i === 0} sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
                  <span className="absolute bottom-2 right-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/90">Imagem ilustrativa</span>
                </div>
                <div className="order-2 text-white md:order-1">
                  <p className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wider ring-1 ring-white/25">{s.eyebrow}</p>
                  <h2 className="mt-3 font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
                    {s.title}
                  </h2>
                  <p className="mt-3 max-w-md text-base text-white/85 md:text-lg">{s.text}</p>
                  <Link
                    href={s.cta.href}
                    tabIndex={active ? 0 : -1}
                    className={cn(
                      "mt-5 inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-bold shadow-lg transition-colors duration-200",
                      s.ctaClass,
                    )}
                  >
                    {s.cta.label} <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => go(index - 1)}
        aria-label="Banner anterior"
        className="absolute left-2 top-[38%] z-20 hidden h-12 w-12 items-center justify-center rounded-full bg-white text-navy shadow-lg transition-transform hover:scale-105 md:flex lg:left-4"
      >
        <ChevronLeft className="h-6 w-6" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => go(index + 1)}
        aria-label="Próximo banner"
        className="absolute right-2 top-[38%] z-20 hidden h-12 w-12 items-center justify-center rounded-full bg-white text-navy shadow-lg transition-transform hover:scale-105 md:flex lg:right-4"
      >
        <ChevronRight className="h-6 w-6" aria-hidden="true" />
      </button>

      <div className="absolute inset-x-0 bottom-[4.5rem] z-20 flex justify-center gap-1 md:bottom-20">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(i)}
            aria-label={`Ir para o banner ${i + 1}`}
            aria-current={i === index}
            className="flex h-6 w-6 items-center justify-center"
          >
            <span className={cn("block h-2 rounded-full bg-white transition-all", i === index ? "w-6" : "w-2 opacity-50")} />
          </button>
        ))}
      </div>
    </section>
  );
}
