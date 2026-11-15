import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Section } from "@/components/content-page";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Sobre a Zexi", description: site.description, alternates: { canonical: "/sobre" } };

export default function Page() {
  return (
    <ContentPage title="Sobre a Zexi" intro={`${site.slogan} ${site.tagline}`}>
      <Section title="O que é">
        <p>
          A Zexi é um marketplace brasileiro onde você compra com preço fixo, assiste transmissões ao vivo das lojas e participa de leilões, tudo
          num lugar só e com a Compra Garantida.
        </p>
      </Section>
      <Section title="Para quem vende">
        <p>
          Lojas de todo o Brasil abrem a vitrine, transmitem ao vivo, fazem leilões e ofertas relâmpago, e recebem pela Zexi.{" "}
          <Link href="/vender" className="font-semibold text-brand hover:underline">Venda na Zexi</Link>.
        </p>
      </Section>
      <Section title="Segurança">
        <p>
          Pagamento e conversa acontecem dentro da plataforma. Contatos externos são ocultados automaticamente e as lojas têm reputação calculada
          por reclamações, cancelamentos e atrasos.
        </p>
      </Section>
    </ContentPage>
  );
}
