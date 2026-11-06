import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Símbolo LIVELANCE: play 3D vermelho com martelo de leilão, órbita e ondas de transmissão.
 * Arquivos em public/brand/. `mono` usa a versão de uma cor, pintada com currentColor.
 */
export function LogoMark({ className, mono = false }: { className?: string; mono?: boolean }) {
  if (mono) {
    return (
      <span
        aria-hidden="true"
        className={cn("inline-block aspect-[92/72] h-9 bg-current", className)}
        style={{
          WebkitMask: "url(/brand/livelance-simbolo-mono.svg) center / contain no-repeat",
          mask: "url(/brand/livelance-simbolo-mono.svg) center / contain no-repeat",
        }}
      />
    );
  }
  return (
    <Image
      src="/brand/livelance-simbolo.svg"
      alt=""
      aria-hidden="true"
      width={92}
      height={72}
      priority
      unoptimized
      className={cn("h-9 w-auto", className)}
    />
  );
}

function Wordmark({ className, mono = false }: { className?: string; mono?: boolean }) {
  return (
    <span className={cn("inline-block -skew-x-[10deg] font-display font-extrabold leading-none tracking-tight", className)}>
      <span className={mono ? undefined : "text-brand"}>LIVE</span>
      <span className={mono ? undefined : "text-navy"}>LANCE</span>
    </span>
  );
}

/** Versão horizontal (cabeçalho). */
export function Logo({ className, mono = false }: { className?: string; mono?: boolean }) {
  return (
    <Link href="/" aria-label="LIVELANCE — página inicial" className={cn("flex items-center gap-1.5", className)}>
      <LogoMark mono={mono} />
      <Wordmark mono={mono} className="text-[1.45rem]" />
    </Link>
  );
}

/** Versão vertical com slogan (login, cadastro, telas de abertura). */
export function LogoStacked({ className }: { className?: string }) {
  return (
    <span className={cn("flex flex-col items-center gap-2", className)} role="img" aria-label="LIVELANCE — Tudo acontece ao vivo.">
      <LogoMark className="h-14" />
      <Wordmark className="text-3xl" />
      <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-navy">
        <span className="h-0.5 w-5 rounded bg-brand" aria-hidden="true" />
        Tudo acontece ao vivo.
        <span className="h-0.5 w-5 rounded bg-brand" aria-hidden="true" />
      </span>
    </span>
  );
}
