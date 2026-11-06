import Link from "next/link";
import { cn } from "@/lib/utils";

/** Símbolo provisório: "B" em verde metálico com faísca dourada (lance). Logo definitivo é entrega separada. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("h-9 w-9", className)}>
      <defs>
        <linearGradient id="borah-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1fa35a" />
          <stop offset="0.5" stopColor="#168447" />
          <stop offset="1" stopColor="#105b35" />
        </linearGradient>
        <linearGradient id="borah-o" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3dc8f" />
          <stop offset="0.5" stopColor="#d6a52d" />
          <stop offset="1" stopColor="#b8891e" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#borah-g)" />
      <path
        d="M15 11h11.5c5.2 0 8.5 2.7 8.5 7 0 2.6-1.3 4.6-3.5 5.6 3 .9 4.8 3.2 4.8 6.3 0 4.8-3.7 7.6-9.4 7.6H15V11Zm6 10.3h4.7c2 0 3.2-1 3.2-2.6s-1.2-2.6-3.2-2.6H21v5.2Zm0 10.9h5.3c2.2 0 3.5-1.1 3.5-2.8s-1.3-2.8-3.5-2.8H21v5.6Z"
        fill="#fff"
      />
      <path d="M38.5 6.5l1.6 3.6 3.6 1.6-3.6 1.6-1.6 3.6-1.6-3.6-3.6-1.6 3.6-1.6 1.6-3.6Z" fill="url(#borah-o)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="BORAH — página inicial" className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-display text-2xl font-extrabold tracking-tight text-metal-green">BORAH</span>
    </Link>
  );
}
