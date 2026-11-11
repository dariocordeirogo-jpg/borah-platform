/** Admin: papéis da equipe, textos de denúncia e moderação (sem segredo). */

export const STAFF_ROLES = ["admin_super", "admin_finance", "admin_ops", "moderator", "support", "analyst"] as const;
export const MODERATOR_ROLES = ["admin_super", "admin_ops", "moderator"] as const;
export const STORE_ADMIN_ROLES = ["admin_super", "admin_ops"] as const;

export function isStaff(roles: readonly string[]): boolean {
  return roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r));
}
export function canModerate(roles: readonly string[]): boolean {
  return roles.some((r) => (MODERATOR_ROLES as readonly string[]).includes(r));
}
export function canManageStores(roles: readonly string[]): boolean {
  return roles.some((r) => (STORE_ADMIN_ROLES as readonly string[]).includes(r));
}

export const reportReasons = {
  fraude: "Golpe ou fraude",
  falsificado: "Produto falsificado",
  proibido: "Produto proibido",
  ofensivo: "Conteúdo ofensivo",
  spam: "Spam ou propaganda",
  outro: "Outro motivo",
} as const;
export type ReportReason = keyof typeof reportReasons;

export const reportKindLabel = {
  product: "Produto",
  video: "Vídeo",
  live: "Live",
  store: "Loja",
  message: "Mensagem do chat",
} as const;
export type ReportKind = keyof typeof reportKindLabel;

export const reportActionLabel: Record<ReportKind, string> = {
  product: "Bloquear produto",
  video: "Remover vídeo",
  live: "Encerrar live",
  store: "Suspender loja",
  message: "Esconder mensagem",
};

export function isReportKind(v: unknown): v is ReportKind {
  return typeof v === "string" && v in reportKindLabel;
}

export function adminErrorMessage(message?: string): string {
  const code = (message ?? "").split(":")[0];
  switch (code) {
    case "forbidden":
      return "Seu papel na equipe não permite essa ação.";
    case "reason_required":
      return "Escreva o motivo (pelo menos 3 letras). Ele fica registrado na auditoria.";
    case "not_found":
      return "Item não encontrado ou já tratado.";
    case "already_reported":
      return "Você já denunciou este item. A equipe está analisando.";
    case "target_not_found":
      return "Não encontramos o item denunciado.";
    case "too_many_reports":
      return "Você atingiu o limite de denúncias de hoje.";
    case "not_authenticated":
      return "Entre na sua conta para continuar.";
    default:
      return "Não foi possível concluir agora. Tente de novo.";
  }
}
