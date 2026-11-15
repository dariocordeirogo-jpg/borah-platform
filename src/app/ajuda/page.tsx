import type { Metadata } from "next";
import Link from "next/link";
import { BadgePercent, Gavel, Package, RotateCcw, ShieldCheck, ShoppingBag, Store, UserRound } from "lucide-react";
import { ContentPage, Faq } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Central de ajuda",
  description: "Tire suas dúvidas sobre compras, pagamentos, entregas, trocas, leilões e vendas na Zexi.",
  alternates: { canonical: "/ajuda" },
};

const topics = [
  { href: "/como-comprar", icon: ShoppingBag, title: "Como comprar", text: "Do carrinho ao pagamento" },
  { href: "/compra-garantida", icon: ShieldCheck, title: "Compra Garantida", text: "Seu dinheiro protegido" },
  { href: "/trocas-e-devolucoes", icon: RotateCcw, title: "Trocas e devoluções", text: "Arrependimento e defeito" },
  { href: "/conta/pedidos", icon: Package, title: "Minhas compras", text: "Acompanhe seus pedidos" },
  { href: "/leiloes/regras", icon: Gavel, title: "Regras dos leilões", text: "Lances e arremate" },
  { href: "/ofertas", icon: BadgePercent, title: "Ofertas", text: "Descontos do dia" },
  { href: "/vender", icon: Store, title: "Vender na Zexi", text: "Abra sua loja" },
  { href: "/conta", icon: UserRound, title: "Minha conta", text: "Dados e segurança" },
];

export default function Page() {
  return (
    <ContentPage title="Central de ajuda" intro="Escolha um assunto ou veja as dúvidas mais comuns.">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {topics.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className="flex h-full flex-col items-center gap-1 rounded-[var(--radius-card)] border border-line bg-white p-4 text-center hover:border-brand">
              <t.icon className="h-6 w-6 text-brand" aria-hidden="true" />
              <span className="font-semibold text-navy">{t.title}</span>
              <span className="text-xs text-muted">{t.text}</span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="font-display text-xl font-bold text-navy">Dúvidas frequentes</h2>
      <div className="space-y-2">
        <Faq q="Como sei se a compra é segura?">
          <p>
            Pagando pela Zexi você tem a <Link href="/compra-garantida" className="font-semibold text-brand hover:underline">Compra Garantida</Link>: o
            dinheiro só vai para a loja depois que você recebe o pedido.
          </p>
        </Faq>
        <Faq q="Quais formas de pagamento posso usar?">
          <p>Cartão de crédito e Pix, direto na Zexi, em ambiente seguro. Um pagamento só, mesmo comprando de várias lojas.</p>
        </Faq>
        <Faq q="Como acompanho a entrega?">
          <p>
            Em <Link href="/conta/pedidos" className="font-semibold text-brand hover:underline">Minhas compras</Link> aparece a linha do tempo do pedido e o
            código de rastreio quando a loja envia. Quando o pacote chegar, toque em &quot;Já recebi&quot;.
          </p>
        </Faq>
        <Faq q="Tive um problema com o pedido. O que faço?">
          <p>
            Abra o pedido em Minhas compras e use &quot;Problema com a compra?&quot; para abrir uma reclamação. A loja é avisada na hora e a conversa
            fica registrada.
          </p>
        </Faq>
        <Faq q="Posso falar com a loja por telefone ou WhatsApp?">
          <p>
            Não. Por segurança, todo contato acontece pela Zexi (perguntas no anúncio e reclamações no pedido). Telefones, e-mails, links e redes
            sociais são ocultados automaticamente. Negociando por fora você perde a Compra Garantida.
          </p>
        </Faq>
        <Faq q="Não recebi o e-mail de confirmação da conta.">
          <p>
            Procure na caixa de spam ou promoções. O link vale por pouco tempo: se expirar, faça o cadastro de novo com o mesmo e-mail ou use
            &quot;Esqueci minha senha&quot; na página de login.
          </p>
        </Faq>
        <Faq q="Como funcionam as ofertas relâmpago?">
          <p>São descontos por tempo limitado. Quando o relógio zera, o preço volta ao normal. Veja as que estão no ar em Ofertas.</p>
        </Faq>
        <Faq q="Como dou lance num leilão?">
          <p>
            Confirme seu CPF e telefone uma vez, escolha o valor e confirme. Veja as{" "}
            <Link href="/leiloes/regras" className="font-semibold text-brand hover:underline">regras dos leilões</Link>.
          </p>
        </Faq>
      </div>
    </ContentPage>
  );
}
