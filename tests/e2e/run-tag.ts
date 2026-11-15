/**
 * Identificador único da execução só com letras (ex.: "BHDJ…").
 * Números longos em títulos e mensagens são ocultados pelo filtro de contato (parecem telefone).
 */
export const runTag = (n = Date.now()) => String(n).replace(/\d/g, (d) => "ABCDEFGHIJ"[Number(d)]);
