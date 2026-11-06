import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de privacidade (rascunho)" };

export default function Page() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <p className="rounded-xl bg-gold-soft px-4 py-3 text-sm font-semibold">
        RASCUNHO — este texto ainda não foi revisado por advogado e não vale como política definitiva.
      </p>
      <h1 className="mt-6 font-display text-3xl font-extrabold">Política de privacidade</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink/90">
        <p>
          Nesta fase a BORAH guarda apenas: nome, e-mail, foto de perfil (quando vem do Google), endereços que você
          cadastrar e o registro da criação da conta.
        </p>
        <h2 className="pt-2 text-lg font-bold">Pontos que a versão final precisa cobrir (LGPD)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Base legal de cada tratamento e finalidade.</li>
          <li>Tratamento de CPF e telefone para verificação de quem dá lances.</li>
          <li>Compartilhamento com provedores de pagamento, logística, vídeo e hospedagem.</li>
          <li>Prazos de retenção, direitos do titular e canal do encarregado (DPO).</li>
          <li>Cookies de sessão e de medição.</li>
        </ul>
      </div>
    </article>
  );
}
