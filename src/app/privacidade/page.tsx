import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de privacidade (rascunho)" };

const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="pt-4 font-display text-lg font-bold text-navy">{children}</h2>;

export default function Page() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark">
        RASCUNHO — este texto ainda não foi revisado por advogado e não vale como política definitiva. Ele descreve o que
        o sistema faz hoje, para servir de base à versão final (LGPD — Lei 13.709/2018).
      </p>
      <h1 className="mt-6 font-display text-3xl font-extrabold">Política de privacidade</h1>
      <div className="mt-6 space-y-3 text-sm leading-relaxed text-ink/90">
        <H2>1. Quais dados a Zexi trata</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Conta: nome, e-mail, foto de perfil (quando você entra com o Google) e data de criação.</li>
          <li>Endereços de entrega que você cadastrar.</li>
          <li>
            Verificação para dar lances: CPF e telefone. O CPF não fica guardado em texto: guardamos um resumo
            criptográfico (hash) para evitar contas duplicadas e uma versão mascarada (ex.: ***.123.456-**).
          </li>
          <li>Pedidos, lances, arremates, cupons usados e histórico de status.</li>
          <li>
            Pagamentos: processados pelo provedor de pagamento (Stripe). A Zexi não recebe nem guarda número de cartão;
            guarda apenas identificadores e o status do pagamento.
          </li>
          <li>Lojas: dados da loja e da conta de recebimento cadastrada no provedor de pagamento.</li>
          <li>Conteúdo que você publica: produtos, fotos, vídeos, lives, mensagens no chat das lives e denúncias.</li>
          <li>Indicações (afiliados): cliques em links de indicação e comissões geradas.</li>
          <li>Registros técnicos e de auditoria: ações administrativas, eventos de pagamento e registros de acesso.</li>
        </ul>

        <H2>2. Para que usamos (finalidade e base legal a confirmar)</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Executar a compra, o leilão e a entrega (execução de contrato).</li>
          <li>Evitar fraude e contas falsas em leilões, com CPF e telefone (legítimo interesse / prevenção à fraude).</li>
          <li>Cumprir obrigações legais, fiscais e de guarda de registros (Marco Civil da Internet).</li>
          <li>Moderar conteúdo e atender denúncias (legítimo interesse e segurança dos usuários).</li>
          <li>Recursos de IA opcionais (descrição de produto, busca e apoio à moderação) — ver item 4.</li>
        </ul>

        <H2>3. Cookies</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Cookies de sessão do login (necessários para manter você conectado).</li>
          <li>
            <code>ll_ref</code>: guarda por até 30 dias o código de quem indicou você, para atribuir a comissão do
            programa de afiliados.
          </li>
          <li>Nesta versão não usamos cookies de publicidade nem de medição de terceiros.</li>
        </ul>

        <H2>4. Com quem compartilhamos (operadores)</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase — banco de dados, autenticação e armazenamento de arquivos.</li>
          <li>Vercel — hospedagem do site.</li>
          <li>Stripe — processamento de pagamentos e repasse às lojas.</li>
          <li>
            Anthropic (Claude) — só quando um recurso de IA é usado: o texto do anúncio, as fotos do produto, o pedido de
            busca ou o conteúdo denunciado são enviados para gerar a resposta. Não enviamos CPF, telefone nem endereço.
          </li>
          <li>Provedor de transmissão das lives (a definir).</li>
          <li>Lojas vendedoras recebem nome e endereço de entrega dos seus pedidos, só para entregar.</li>
        </ul>

        <H2>5. Por quanto tempo guardamos</H2>
        <p>Prazos de retenção por tipo de dado serão definidos na versão final, respeitando obrigações legais e fiscais.</p>

        <H2>6. Seus direitos</H2>
        <p>
          Você pode pedir confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação, informação
          sobre compartilhamentos e revogação de consentimento (art. 18 da LGPD).
        </p>

        <H2>7. Encarregado (DPO) e contato</H2>
        <p>O nome e o canal do encarregado pelo tratamento de dados serão publicados aqui antes do lançamento.</p>
      </div>
    </article>
  );
}
