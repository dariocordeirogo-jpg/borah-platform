/** ZEXI LIVE: textos e validações que podem ir ao navegador. */

export const liveStatusLabel = {
  scheduled: "Programada",
  live: "Ao vivo",
  ended: "Encerrada",
  cancelled: "Cancelada",
} as const;

/** Link HLS do serviço de transmissão: https e terminando em .m3u8 (com ou sem parâmetros). */
export function isPlaybackUrl(value: string): boolean {
  if (value.length > 500) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && /\.m3u8$/i.test(u.pathname);
  } catch {
    return false;
  }
}

/** Link de reprodução do Mux (https://stream.mux.com/<playback>.m3u8) → id de reprodução; outros serviços → null. */
export function muxPlaybackId(url: string | null): string | null {
  const m = url?.match(/^https:\/\/stream\.mux\.com\/([A-Za-z0-9]{10,100})\.m3u8$/);
  return m ? m[1] : null;
}

export const liveAuctionMinutes = [5, 10, 15] as const;

export function liveErrorMessage(message?: string): string {
  const code = (message ?? "").split(":")[0];
  switch (code) {
    case "products_required":
      return "Escolha pelo menos um produto (até 30).";
    case "product_not_found":
      return "Só produtos ativos da sua loja podem entrar na live.";
    case "invalid_schedule":
      return "Escolha uma data entre agora e os próximos 60 dias.";
    case "invalid_url":
      return "Use o link HLS (https, terminando em .m3u8) do serviço de transmissão.";
    case "live_not_scheduled":
      return "Esta live já começou ou terminou.";
    case "live_not_live":
      return "A live não está no ar.";
    case "live_finished":
      return "Esta live já terminou.";
    case "product_not_in_live":
      return "Esse produto não faz parte da live.";
    case "live_auction_running":
      return "Já existe um leilão relâmpago em andamento nesta live.";
    case "no_stock":
      return "Produto sem estoque para leiloar.";
    case "invalid_duration":
      return "Duração inválida para o leilão.";
    case "stream_unavailable":
      return "O serviço de transmissão não respondeu agora. Tente de novo em instantes.";
    case "stream_exists":
      return "Esta live já tem uma transmissão.";
    case "invalid_stream":
      return "O serviço de transmissão devolveu dados inválidos. Tente de novo.";
    case "too_fast":
      return "Calma! Espere um instante para mandar outra mensagem.";
    case "invalid_message":
      return "Escreva uma mensagem de até 200 caracteres.";
    case "not_authenticated":
      return "Entre na sua conta para continuar.";
    case "live_not_found":
    case "message_not_found":
      return "Não encontrado.";
    default:
      return "Não foi possível concluir agora. Tente de novo.";
  }
}
