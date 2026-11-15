import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = { title: "Como comprar", description: "Passo a passo para comprar na Zexi com segurança.", alternates: { canonical: "/como-comprar" } };

const steps = [
  ["Encontre o produto", "Use a busca, as categorias, as ofertas ou compre durante uma transmissão ao vivo."],
  ["Tire suas dúvidas", "Pergunte ao vendedor na página do anúncio. Veja as opiniões de quem já comprou e a reputação da loja."],
  ["Compre ou adicione ao carrinho", "\"Comprar agora\" leva direto ao pagamento; o carrinho junta produtos de várias lojas."],
  ["Pague na Zexi", "Cartão de crédito ou Pix, num pagamento só. A Compra Garantida protege seu dinheiro até a entrega."],
  ["Acompanhe a entrega", "Em Minhas compras você vê a linha do tempo e o código de rastreio. Ao receber, confirme e avalie."],
];

export default function Page() {
  return (
    <ContentPage title="Como comprar" intro="Comprar na Zexi é simples e seguro. Veja o passo a passo.">
      <ol className="space-y-3">
        {steps.map(([t, d], i) => (
          <li key={t} className="flex gap-4 rounded-[var(--radius-card)] border border-line bg-white p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white">{i + 1}</span>
            <div>
              <p className="font-semibold text-navy">{t}</p>
              <p className="text-muted">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      <Section title="Dica de segurança">
        <p>
          Nunca pague por fora nem passe seus dados por mensagem. Na Zexi, contato e pagamento ficam dentro da plataforma, e é isso que garante a{" "}
          <Link href="/compra-garantida" className="font-semibold text-brand hover:underline">Compra Garantida</Link>.
        </p>
      </Section>
    </ContentPage>
  );
}
