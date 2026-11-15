import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Compra Garantida",
  description: "Na Zexi o dinheiro só vai para a loja depois que você recebe o pedido.",
  alternates: { canonical: "/compra-garantida" },
};

export default function Page() {
  return (
    <ContentPage title="Compra Garantida" intro="Seu dinheiro fica protegido até o pedido chegar.">
      <Section title="Como funciona">
        <ul className="list-disc space-y-1 pl-5">
          <li>Você paga na Zexi, com cartão ou Pix.</li>
          <li>O valor fica retido e a loja é avisada para enviar.</li>
          <li>Quando você confirma o recebimento (ou o prazo de entrega termina sem problema), o dinheiro é liberado para a loja.</li>
          <li>Se algo der errado, abra uma reclamação no pedido antes de confirmar o recebimento.</li>
        </ul>
      </Section>
      <Section title="Quando a garantia vale">
        <ul className="list-disc space-y-1 pl-5">
          <li>Compra paga pela Zexi (carrinho, comprar agora, transmissão ao vivo ou arremate de leilão).</li>
          <li>Conversa feita pela Zexi: perguntas no anúncio e reclamação no pedido.</li>
        </ul>
        <p className="font-semibold text-navy">Pagamento ou combinação feitos fora da Zexi não têm garantia.</p>
      </Section>
      <p>
        Veja também <Link href="/trocas-e-devolucoes" className="font-semibold text-brand hover:underline">Trocas e devoluções</Link>.
      </p>
    </ContentPage>
  );
}
