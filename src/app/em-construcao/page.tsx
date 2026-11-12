import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { Lock } from "lucide-react";
import { unlockSite } from "./actions";

export const metadata: Metadata = { title: "Em construção", robots: { index: false, follow: false } };
type SP = { erro?: string; next?: string };

async function Gate({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  return (
    <form action={unlockSite} className="mt-8 w-full max-w-xs space-y-3">
      <input type="hidden" name="next" value={sp.next ?? "/"} />
      <label htmlFor="password" className="block text-left text-sm font-semibold text-white/80">
        Acesso interno
      </label>
      <div className="flex gap-2">
        <input
          id="password"
          name="password"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          required
          aria-invalid={sp.erro ? true : undefined}
          aria-describedby={sp.erro ? "senha-erro" : undefined}
          className="h-12 min-w-0 flex-1 rounded-full border border-white/20 bg-white/10 px-5 text-base text-white placeholder:text-white/40 focus:border-brand focus:outline-none"
          placeholder="Senha"
        />
        <button type="submit" className="h-12 rounded-full bg-brand px-6 font-bold text-white transition-colors hover:bg-brand-dark">
          Entrar
        </button>
      </div>
      {sp.erro && (
        <p id="senha-erro" role="alert" className="text-sm text-brand-bright">
          Senha incorreta.
        </p>
      )}
    </form>
  );
}

export default function Page({ searchParams }: PageProps<"/em-construcao">) {
  return (
    <main data-site-gate className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto bg-navy px-4 py-10 text-center text-white">
      <Image src="/brand/zexi-logo-branco.svg" alt="Zexi" width={515} height={174} priority unoptimized className="h-16 w-auto md:h-20" />
      <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-wider ring-1 ring-white/20">
        <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" /> EM CONSTRUÇÃO
      </p>
      <h1 className="mt-4 max-w-xl font-display text-3xl font-extrabold tracking-tight md:text-5xl">Tudo acontece ao vivo. Em breve.</h1>
      <p className="mt-3 max-w-md text-white/70">
        Marketplace, vendas ao vivo e leilões em um só lugar. Estamos preparando a Zexi para você.
      </p>
      <Suspense fallback={<div className="mt-8 h-24" />}>
        <Gate searchParams={searchParams as Promise<SP>} />
      </Suspense>
      <p className="mt-10 flex items-center gap-1.5 text-xs text-white/40">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Área restrita à equipe Zexi
      </p>
    </main>
  );
}
