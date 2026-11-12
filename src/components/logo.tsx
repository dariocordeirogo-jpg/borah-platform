import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Símbolo Zexi: "Z" geométrico com cortes diagonais (o braço central sugere o "X" do encontro entre quem compra e
 * quem vende) e o ponto coral no alto à direita, o indicador de AO VIVO.
 * Arquivos em public/brand/. `tone="light"` é para fundo escuro; `mono` usa uma cor só (currentColor).
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
        className={cn("inline-block aspect-[104/86] h-8 bg-current", className)}
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
      width={104}
      height={86}
      priority
      unoptimized
      className={cn("h-8 w-auto", className)}
    />
  );
}

/** "zexi" em minúsculas; o pingo do i é o ponto coral de AO VIVO. */
function Wordmark({ className, mono = false }: { className?: string; mono?: boolean }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex items-baseline font-display font-extrabold lowercase leading-none tracking-tight", className)}>
      zex
      <span className="relative inline-block leading-none">
        ı
        <span
          className={cn(
            "absolute left-1/2 top-[0.13em] h-[0.2em] w-[0.2em] -translate-x-1/2 rounded-full",
            mono ? "bg-current" : "bg-brand-vivid",
          )}
        />
      </span>
    </span>
  );
}

/** Versão horizontal (cabeçalho e rodapé). */
export function Logo({ className, mono = false, tone = "dark" }: { className?: string; mono?: boolean; tone?: "dark" | "light" }) {
  return (
    <Link
      href="/"
      aria-label="Zexi — página inicial"
      className={cn("flex items-center gap-2", tone === "light" ? "text-white" : "text-navy", className)}
    >
      <LogoMark mono={mono} tone={tone} />
      <Wordmark mono={mono} className="text-[1.7rem]" />
    </Link>
  );
}

/** Versão vertical com slogan (login, cadastro, telas de abertura). */
export function LogoStacked({ className }: { className?: string }) {
  return (
    <span className={cn("flex flex-col items-center gap-2 text-navy", className)} role="img" aria-label="Zexi — Tudo acontece ao vivo.">
      <LogoMark className="h-14" />
      <Wordmark className="text-4xl" />
      <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em]">
        <span className="h-0.5 w-5 rounded bg-brand-vivid" aria-hidden="true" />
        Tudo acontece ao vivo.
        <span className="h-0.5 w-5 rounded bg-brand-vivid" aria-hidden="true" />
      </span>
    </span>
  );
}
