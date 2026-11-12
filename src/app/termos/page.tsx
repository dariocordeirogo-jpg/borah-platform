import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Termos de uso (rascunho)" };

const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="pt-4 font-display text-lg font-bold text-navy">{children}</h2>;

export default function Page() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark">
        RASCUNHO — este texto ainda não foi revisado por advogado e não vale como termo definitivo. Ele descreve as regras
        que o sistema aplica hoje, para servir de base à versão final.
      </p>
      <h1 className="mt-6 font-display text-3xl font-extrabold">Termos de uso da Zexi</h1>
      <div className="mt-6 space-y-3 text-sm leading-relaxed text-ink/90">
        <H2>1. O que é a Zexi</H2>
        <p>
          A Zexi (zexi.com.br) é uma plataforma de intermediação que conecta compradores e lojas em três
          modalidades: marketplace (ZEXI MARKET), vendas em transmissões ao vivo (ZEXI LIVE) e leilões
          digitais (ZEXI LEILÕES). Quem vende é a loja; a Zexi intermedeia.
        </p>

        <H2>2. Conta</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Uma conta por pessoa; você é responsável pelo acesso à sua conta.</li>
          <li>Para dar lances é preciso informar CPF e telefone válidos.</li>
        </ul>

        <H2>3. Compras e pagamentos</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Preço, estoque e total do pedido são confirmados pelo sistema no momento do pedido, não pelo navegador.</li>
          <li>
            Pagamentos são processados por provedor autorizado (ZEXI PAY, via Stripe), com repasse direto à loja. A
            Zexi retém apenas a sua taxa de intermediação e não mantém saldo em custódia.
          </li>
          <li>Direito de arrependimento em compras a distância (art. 49 do CDC) e regras do Decreto 7.962/2013.</li>
        </ul>

        <H2>4. Leilões</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Cada leilão tem lance inicial, incremento mínimo e horário de encerramento informados na página.</li>
          <li>Anti-sniping: lance nos últimos instantes prorroga o encerramento.</li>
          <li>O lance é um compromisso de compra. O vencedor tem prazo para pagar o arremate.</li>
          <li>
            Arremate sem pagamento: perda do arremate; a partir da 3ª ocorrência, bloqueio de lances por 7 dias.
          </li>
          <li>O enquadramento das modalidades de leilão perante as regras da profissão de leiloeiro está em análise jurídica.</li>
        </ul>

        <H2>5. Lojas</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>A loja responde pelos produtos, pela descrição, pela entrega e pela garantia.</li>
          <li>Produtos proibidos: armas e munição, drogas, medicamentos controlados, animais silvestres, documentos, dados pessoais, produtos roubados, falsificações e serviços ilegais.</li>
          <li>Descrições geradas com IA são sugestões: a loja revisa e responde pelo texto publicado.</li>
        </ul>

        <H2>6. Vídeos, lives e chat</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Proibido conteúdo ofensivo, discriminatório, sexual, violento, spam e pedido de pagamento fora da plataforma.</li>
          <li>Qualquer pessoa pode denunciar. A equipe pode ocultar mensagens, remover vídeos, encerrar lives, bloquear produtos e suspender lojas; toda ação fica registrada com o motivo.</li>
        </ul>

        <H2>7. Programa de indicação (afiliados)</H2>
        <p>
          Quem indica recebe comissão sobre pedidos pagos feitos a partir do seu link, nas condições publicadas na página
          do programa. Pedidos cancelados ou estornados não geram comissão. Forma e prazo de pagamento das comissões serão
          definidos na versão final.
        </p>

        <H2>8. Privacidade</H2>
        <p>
          O tratamento de dados pessoais está descrito na <Link href="/privacidade" className="text-brand hover:underline">Política de privacidade</Link>.
        </p>
      </div>
    </article>
  );
}
