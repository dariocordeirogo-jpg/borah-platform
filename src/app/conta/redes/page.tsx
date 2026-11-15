import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Link2 } from "lucide-react";
import { Notice } from "@/components/market";
import { LinkCode } from "@/components/social/link-code";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { unlinkSocial } from "@/lib/social/actions";
import { platformLabel, socialPlatforms } from "@/lib/social/format";
import { getMySocialLinks } from "@/lib/social/queries";

export const metadata: Metadata = { title: "TikTok e Instagram", robots: { index: false } };

async function Links({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const sp = await searchParams;
  if (!(await getCurrentUser())) redirect(`/entrar?next=${encodeURIComponent("/conta/redes")}`);
  const links = await getMySocialLinks();

  return (
    <div className="space-y-5">
      {sp.erro && <Notice tone="error">{sp.erro}</Notice>}
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-navy">
          <Link2 className="h-6 w-6 text-brand" aria-hidden="true" /> Comprar e dar lance pelo TikTok e Instagram
        </h1>
        <p className="mt-1 text-sm text-muted">
          Quando uma loja da Zexi faz live no TikTok ou no Instagram, você pode comentar <strong>LANCE 150</strong> para dar
          lance ou <strong>EU QUERO</strong> para colocar o produto em destaque no seu carrinho. Vale só para o @ vinculado à
          sua conta; o pagamento é sempre aqui na Zexi.
        </p>
      </header>

      <section aria-label="Contas vinculadas" className="rounded-[var(--radius-card)] border border-line bg-white p-5">
        <h2 className="font-semibold text-navy">Suas contas</h2>
        <ul className="mt-3 divide-y divide-line">
          {socialPlatforms.map((p) => {
            const link = links.find((l) => l.platform === p);
            return (
              <li key={p} className="flex items-center justify-between gap-3 py-3" data-testid={`vinculo-${p}`}>
                <span className="text-sm">
                  <strong className="text-navy">{platformLabel[p]}</strong>{" "}
                  {link ? <span className="text-muted">@{link.username}</span> : <span className="text-muted">não vinculado</span>}
                </span>
                {link && (
                  <form action={unlinkSocial}>
                    <input type="hidden" name="platform" value={p} />
                    <Button type="submit" variant="outline" size="sm">
                      Desvincular
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Vincular conta" className="space-y-3 rounded-[var(--radius-card)] border border-line bg-white p-5">
        <h2 className="font-semibold text-navy">Vincular um @</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Gere o código abaixo.</li>
          <li>Entre numa live de loja da Zexi no TikTok ou no Instagram, com o @ que você quer vincular.</li>
          <li>Comente só o código (ex.: ZX123456). Pronto: o @ fica ligado à sua conta.</li>
        </ol>
        <LinkCode />
        <p className="text-xs text-muted">
          Para dar lance, confirme também seu CPF e celular em “Verificação para dar lances”. Ninguém vê seu código no
          chat da Zexi.
        </p>
      </section>
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/conta/redes">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />}>
        <Links searchParams={searchParams as Promise<{ erro?: string }>} />
      </Suspense>
    </div>
  );
}
