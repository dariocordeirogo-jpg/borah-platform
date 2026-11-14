import Link from "next/link";
import { ArrowRight, ShieldCheck, Ticket } from "lucide-react";

/** Faixa de banners no meio da home: só promessas que a plataforma já cumpre. */
export function PromoBanners() {
  const items = [
    {
      href: "/market",
      icon: ShieldCheck,
      eyebrow: "COMPRA GARANTIDA",
      title: "Seu dinheiro protegido até a entrega",
      text: "A loja só recebe depois que você confirma que o pedido chegou.",
      cls: "bg-navy text-white",
      cta: "Comprar com segurança",
    },
    {
      href: "/market",
      icon: Ticket,
      eyebrow: "CUPONS DAS LOJAS",
      title: "Tem cupom? Tem desconto.",
      text: "Digite o código da loja ao finalizar a compra e veja o desconto na hora.",
      cls: "bg-gradient-to-br from-brand to-brand-dark text-white",
      cta: "Ver ofertas",
    },
  ];
  return (
    <section aria-label="Destaques" className="grid gap-3 md:grid-cols-2">
      {items.map((b) => (
        <Link key={b.eyebrow} href={b.href} className={`group flex items-center gap-4 rounded-xl p-5 md:p-6 ${b.cls}`}>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/15">
            <b.icon className="h-7 w-7" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-bold tracking-wider opacity-80">{b.eyebrow}</span>
            <span className="block font-display text-lg font-extrabold leading-tight md:text-xl">{b.title}</span>
            <span className="mt-1 block text-sm opacity-85">{b.text}</span>
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold underline-offset-2 group-hover:underline">
              {b.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </span>
        </Link>
      ))}
    </section>
  );
}
