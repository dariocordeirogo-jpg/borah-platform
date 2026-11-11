import { formatBRL } from "@/lib/format";

/** Mesma regra do banco (private.cpf_is_valid), para avisar antes de enviar. */
export function isValidCPF(input: string): boolean {
  const d = input.replace(/\D/g, "");
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const digit = (len: number) => {
    let s = 0;
    for (let i = 0; i < len; i++) s += Number(d[i]) * (len + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digit(9) === Number(d[9]) && digit(10) === Number(d[10]);
}

export function formatPhoneBR(e164: string): string {
  const d = e164.replace(/^\+55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

export const durationOptions = [
  { minutes: 60, label: "1 hora" },
  { minutes: 360, label: "6 horas" },
  { minutes: 1440, label: "1 dia" },
  { minutes: 4320, label: "3 dias" },
  { minutes: 10080, label: "7 dias" },
] as const;

export const outcomeLabel = {
  sold: "Arrematado",
  no_bids: "Encerrado sem lances",
  reserve_not_met: "Preço de reserva não atingido",
  unpaid: "Arremate não confirmado — lote relançado",
  cancelled: "Cancelado pela loja",
} as const;

/** Traduz os erros das funções de leilão do banco. */
export function auctionErrorMessage(message: string | undefined): string {
  const [code, detail] = (message ?? "").split(":");
  const min = detail ? formatBRL(Number(detail)) : "";
  switch (code) {
    case "bid_too_low":
      return `O lance mínimo agora é ${min}.`;
    case "bid_too_high":
      return `Lance muito acima do mínimo (${min}). Confira o valor digitado.`;
    case "already_leading":
      return "Você já tem o maior lance.";
    case "own_auction":
      return "Você não pode dar lance no leilão da sua própria loja.";
    case "auction_closed":
      return "Este leilão já terminou.";
    case "auction_not_started":
      return "Este leilão ainda não começou.";
    case "verification_required":
      return "Para dar lances, confirme seu CPF e telefone.";
    case "phone_unverified":
      return "Confirme seu telefone para dar lances.";
    case "bid_blocked":
      return "Sua conta está temporariamente impedida de dar lances por arremates não confirmados.";
    case "auction_banned":
      return "Você não pode mais dar lances neste lote porque não confirmou um arremate anterior dele.";
    case "cpf_invalid":
      return "CPF inválido. Confira os números.";
    case "cpf_in_use":
      return "Este CPF já está cadastrado em outra conta.";
    case "phone_invalid":
      return "Telefone inválido. Use DDD + número.";
    case "no_stock":
      return "O produto precisa ter pelo menos 1 unidade em estoque.";
    case "invalid_duration":
      return "Duração inválida.";
    case "invalid_start":
      return "O início pode ser no máximo daqui a 30 dias.";
    case "auction_has_bids":
      return "Leilão com lances não pode ser cancelado.";
    case "win_expired":
      return "O prazo para confirmar este arremate terminou.";
    case "address_not_found":
      return "Escolha um endereço de entrega.";
    case "not_authenticated":
      return "Entre na sua conta para continuar.";
    default:
      return "Não foi possível concluir agora. Tente de novo.";
  }
}
