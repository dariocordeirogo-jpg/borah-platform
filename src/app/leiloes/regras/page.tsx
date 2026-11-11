import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Regras dos leilões",
  description: "Como funcionam os leilões da LIVELANCE: lances, prorrogação automática, arremate e prazos.",
  alternates: { canonical: "/leiloes/regras" },
};

const rules = [
  ["Quem pode dar lance", "Contas com CPF válido e telefone cadastrados. Cada CPF vale para uma única conta. Quem vende não dá lance nos próprios leilões."],
  ["Lance mínimo", "O primeiro lance é o lance inicial definido pela loja. Depois, cada lance precisa superar o maior lance pelo menos no incremento mínimo mostrado na página."],
  ["Lance é compromisso", "Um lance não pode ser desfeito. Quem tem o maior lance ao fim do cronômetro arremata o lote."],
  ["Horário oficial", "O cronômetro e o horário de fim são os do servidor da LIVELANCE, não os do seu aparelho."],
  ["Prorrogação automática", "Se um lance chegar nos últimos 2 minutos, o leilão é prorrogado para 2 minutos depois desse lance. Isso evita lances de última hora sem chance de resposta (máximo de 10 prorrogações)."],
  ["Preço de reserva", "A loja pode definir um valor mínimo para vender. Se o maior lance não atingir a reserva, o leilão termina sem vencedor."],
  ["Confirmação do arremate", "Quem vence tem 48 horas para confirmar o arremate e escolher o endereço de entrega. Depois de confirmar, o pagamento é feito pelo LIVELANCE PAY na página do pedido."],
  ["Arremate não confirmado", "Quem não confirma no prazo perde o arremate e não pode mais dar lances naquele lote, que volta para leilão. A partir da 3ª vez, a conta fica 7 dias sem poder dar lances."],
];

export default function Page() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark">
        RASCUNHO — regras ainda sem revisão jurídica. O enquadramento dos leilões precisa de parecer antes do lançamento.
      </p>
      <h1 className="mt-6 font-display text-3xl font-extrabold text-navy">Regras dos leilões</h1>
      <dl className="mt-6 space-y-5">
        {rules.map(([t, d]) => (
          <div key={t}>
            <dt className="font-semibold text-navy">{t}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-ink">{d}</dd>
          </div>
        ))}
      </dl>
      <Link href="/leiloes" className="mt-8 inline-block text-sm font-semibold text-brand hover:underline">
        ← Ver leilões
      </Link>
    </article>
  );
}
