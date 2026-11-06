import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos de uso (rascunho)" };

export default function Page() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <p className="rounded-xl bg-brand-soft text-brand-dark px-4 py-3 text-sm font-semibold">
        RASCUNHO — este texto ainda não foi revisado por advogado e não vale como termo definitivo.
      </p>
      <h1 className="mt-6 font-display text-3xl font-extrabold">Termos de uso da LIVELANCE</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink/90">
        <p>
          A LIVELANCE (livelance.com.br) é uma plataforma de intermediação que conecta compradores e vendedores em três
          modalidades: marketplace (LIVELANCE MARKET), vendas em transmissões ao vivo (LIVELANCE LIVE) e leilões
          digitais (LIVELANCE LEILÕES).
        </p>
        <h2 className="pt-2 text-lg font-bold">Pontos que a versão final precisa cobrir</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Responsabilidades da plataforma, dos vendedores e dos compradores (CDC e Decreto 7.962/2013).</li>
          <li>Regras de leilão: lance mínimo, incremento, anti-sniping, encerramento, preço de reserva.</li>
          <li>Arremate sem pagamento: perda do arremate e da participação naquele leilão; a partir da 3ª ocorrência, bloqueio de lances por 7 dias.</li>
          <li>Exigência de CPF e telefone verificados para dar lances.</li>
          <li>Programa de afiliados: atribuição, comissões, prazos e cancelamentos.</li>
          <li>Conteúdo de vídeos e lives, moderação e publicidade identificada.</li>
          <li>Pagamentos processados por provedor autorizado (LIVELANCE PAY); a LIVELANCE não mantém saldo em custódia.</li>
          <li>Enquadramento das modalidades de leilão perante as regras da profissão de leiloeiro.</li>
        </ul>
      </div>
    </article>
  );
}
