/** Textos usados para montar o contexto enviado à IA. */
export const conditionLabel = { new: "Novo", used: "Usado", refurbished: "Recondicionado" } as const;

export function formatBRLText(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
