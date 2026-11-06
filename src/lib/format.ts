/** Valores em dinheiro circulam sempre em centavos (inteiros). */
export function formatBRL(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error("formatBRL espera centavos inteiros");
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/** Formata segundos restantes como "2d 04:10:05", "04:10:05" ou "Encerrado". */
export function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "Encerrado";
  const s = Math.floor(totalSeconds);
  const days = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}
