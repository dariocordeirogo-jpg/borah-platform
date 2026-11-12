import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Logo Zexi — arquivos vetorizados a partir da arte original da marca (public/brand/), sem redesenho:
 * símbolo "Z" com o traço em "X" e o ponto laranja de AO VIVO; palavra "zexi" com o pingo do i laranja.
 * `tone="light"` é a versão branca para fundo escuro; `mono` pinta o símbolo com uma cor só (currentColor).
 */
export function LogoMark({
  className,
  mono = false,
  tone = "dark",
}: {
  className?: string;
  mono?: boolean;
  tone?: "dark" | "light";
}) {
  if (mono) {
    return (
      <span
        aria-hidden="true"
        className={cn("inline-block aspect-[1800/1740] h-8 bg-current", className)}
        style={{
          WebkitMask: "url(/brand/zexi-simbolo-mono.svg) center / contain no-repeat",
          mask: "url(/brand/zexi-simbolo-mono.svg) center / contain no-repeat",
        }}
      />
    );
  }
  return (
    <Image
      src={tone === "light" ? "/brand/zexi-simbolo-branco.svg" : "/brand/zexi-simbolo.svg"}
      alt=""
      aria-hidden="true"
      width={180}
      height={174}
      priority
      unoptimized
      className={cn("h-8 w-auto", className)}
    />
  );
}

/** Versão horizontal (cabeçalho e rodapé): símbolo + "zexi". */
export function Logo({ className, tone = "dark" }: { className?: string; mono?: boolean; tone?: "dark" | "light" }) {
  return (
    <Link href="/" aria-label="Zexi — página inicial" className={cn("flex items-center", className)}>
      <Image
        src={tone === "light" ? "/brand/zexi-logo-branco.svg" : "/brand/zexi-logo.svg"}
        alt=""
        aria-hidden="true"
        width={515}
        height={174}
        priority
        unoptimized
        className="h-9 w-auto"
      />
    </Link>
  );
}

/** Versão vertical com slogan (login, cadastro, telas de abertura). */
export function LogoStacked({ className }: { className?: string }) {
  return (
    <span className={cn("flex flex-col items-center gap-3 text-navy", className)} role="img" aria-label="Zexi — Tudo acontece ao vivo.">
      <LogoMark className="h-14" />
      <Image src="/brand/zexi-palavra.svg" alt="" aria-hidden="true" width={301} height={128} unoptimized className="h-9 w-auto" />
      <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em]">
        <span className="h-0.5 w-5 rounded bg-brand-vivid" aria-hidden="true" />
        Tudo acontece ao vivo.
        <span className="h-0.5 w-5 rounded bg-brand-vivid" aria-hidden="true" />
      </span>
    </span>
  );
}
