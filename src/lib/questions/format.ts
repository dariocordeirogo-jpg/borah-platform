/** Perguntas e respostas: textos que podem ir ao navegador. */

export function questionErrorMessage(message?: string): string {
  switch ((message ?? "").split(":")[0]) {
    case "invalid_question":
      return "Escreva a pergunta com 5 a 500 caracteres.";
    case "invalid_answer":
      return "Escreva a resposta com 2 a 1000 caracteres.";
    case "own_product":
      return "Este produto é da sua loja.";
    case "too_many_questions":
      return "Muitas perguntas em pouco tempo. Tente de novo mais tarde.";
    case "product_not_found":
    case "question_not_found":
      return "Não encontrado.";
    case "not_authenticated":
      return "Entre na sua conta para perguntar.";
    default:
      return "Não foi possível enviar agora. Tente de novo.";
  }
}

/** "há 3 dias" (data em UTC exibida no horário de Brasília). */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "agora";
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `há ${d} ${d === 1 ? "dia" : "dias"}`;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
