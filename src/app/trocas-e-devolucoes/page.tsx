import type { Metadata } from "next";
import { ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Trocas e devoluções",
  description: "Direito de arrependimento, produto com defeito ou diferente do anúncio: veja como resolver na Zexi.",
  alternates: { canonical: "/trocas-e-devolucoes" },
};

export default function Page() {
  return (
    <ContentPage title="Trocas e devoluções" intro="Seus direitos como consumidor e como resolver pela Zexi.">
      <Section title="Arrependimento (até 7 dias)">
        <p>
          Em compras pela internet você pode desistir em até 7 dias depois de receber o produto (art. 49 do Código de Defesa do Consumidor). Abra
          o pedido em Minhas compras e use &quot;Problema com a compra?&quot; com o motivo &quot;Outro problema&quot;.
        </p>
      </Section>
      <Section title="Defeito, dano ou diferente do anúncio">
        <p>
          Abra uma reclamação no pedido em até 30 dias depois da entrega, escolha o motivo e conte o que aconteceu. A loja é avisada na hora e
          deve resolver com você pela Zexi.
        </p>
      </Section>
      <Section title="Não recebi">
        <p>Se o prazo de entrega passou, abra a reclamação com o motivo &quot;Não recebi o produto&quot;. Não confirme o recebimento antes de o pacote chegar.</p>
      </Section>
      <Section title="Reclamações e reputação">
        <p>Reclamações entram na reputação da loja. Lojas que resolvem rápido (em até 48 horas) não são prejudicadas.</p>
      </Section>
    </ContentPage>
  );
}
