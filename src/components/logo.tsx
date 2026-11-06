import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Símbolo LIVELANCE: o "play" da transmissão ao vivo (branco) com a seta de lance subindo (dourado)
 * e o ponto de "ao vivo" (vermelho). Funciona sozinho como ícone do app e favicon.
 * `mono` desenha tudo em uma cor (currentColor) para fundos escuros, carimbos e impressão.
 */
export function LogoMark({ className, mono = false }: { className?: string; mono?: boolean }) {
  if (mono) {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("h-9 w-9", className)} fill="currentColor">
        <path d="M10 12v24c0 1.6 1.7 2.5 3 1.7l15.5-10.3c1.1-.8 1.1-2.6 0-3.4L13 10.3c-1.3-.8-3 .1-3 1.7Z" />
        <path d="M37.5 20.5l7 6h-4.3V40h-5.4V26.5h-4.3z" />
        <circle cx="40" cy="9" r="3.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("h-9 w-9", className)}>
      <defs>
        <linearGradient id="ll-green" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1fa35a" />
          <stop offset="0.55" stopColor="#168447" />
          <stop offset="1" stopColor="#0d4a2b" />
        </linearGradient>
        <linearGradient id="ll-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3dc8f" />
          <stop offset="0.5" stopColor="#d6a52d" />
          <stop offset="1" stopColor="#b8891e" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#ll-green)" />
      {/* play da transmissão */}
      <path d="M10 12v24c0 1.6 1.7 2.5 3 1.7l15.5-10.3c1.1-.8 1.1-2.6 0-3.4L13 10.3c-1.3-.8-3 .1-3 1.7Z" fill="#fff" />
      {/* seta de lance subindo */}
      <path d="M37.5 20.5l7 6h-4.3V40h-5.4V26.5h-4.3z" fill="url(#ll-gold)" />
      {/* ponto "ao vivo" */}
      <circle cx="40" cy="9" r="3.4" fill="#E5484D" stroke="#fff" strokeWidth="1.4" />
    </svg>
  );
}

function Wordmark({ className, mono = false }: { className?: string; mono?: boolean }) {
  return (
    <span className={cn("font-display font-extrabold leading-none tracking-tight", className)}>
      <span className={mono ? undefined : "text-green-deep"}>LIVE</span>
      <span className={mono ? undefined : "text-metal-gold"}>LANCE</span>
    </span>
  );
}

/** Versão horizontal (cabeçalho). */
export function Logo({ className, mono = false }: { className?: string; mono?: boolean }) {
  return (
    <Link href="/" aria-label="LIVELANCE — página inicial" className={cn("flex items-center gap-2", className)}>
      <LogoMark mono={mono} />
      <Wordmark mono={mono} className="text-[1.4rem]" />
    </Link>
  );
}

/** Versão vertical (telas de login, splash, materiais quadrados). */
export function LogoStacked({ className, mono = false }: { className?: string; mono?: boolean }) {
  return (
    <span className={cn("flex flex-col items-center gap-2", className)} role="img" aria-label="LIVELANCE">
      <LogoMark mono={mono} className="h-14 w-14" />
      <Wordmark mono={mono} className="text-2xl" />
    </span>
  );
}
