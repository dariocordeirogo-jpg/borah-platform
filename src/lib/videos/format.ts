/** Vídeos curtos: regras do arquivo (o bucket repete os mesmos limites no Storage). */
export const VIDEO_BUCKET = "product-videos";
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const VIDEO_TYPES = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" } as const;

export type VideoType = keyof typeof VIDEO_TYPES;

/** Confere tipo e tamanho antes do envio. Devolve a mensagem de erro ou null. */
export function checkVideoFile(file: { type: string; size: number }): string | null {
  if (!(file.type in VIDEO_TYPES)) return "Envie um vídeo MP4, WebM ou MOV.";
  if (file.size > MAX_VIDEO_BYTES) return "O vídeo pode ter no máximo 50 MB.";
  if (file.size === 0) return "Arquivo vazio.";
  return null;
}

export function videoErrorMessage(message: string | undefined): string {
  const code = (message ?? "").split(":")[0];
  switch (code) {
    case "product_not_found":
      return "Escolha um produto da sua loja.";
    case "invalid_path":
    case "file_not_found":
      return "O envio do arquivo não terminou. Tente de novo.";
    case "store_required":
      return "Abra sua loja antes de publicar vídeos.";
    case "video_not_found":
      return "Vídeo não encontrado.";
    case "not_authenticated":
      return "Entre na sua conta para continuar.";
    default:
      return "Não foi possível concluir agora. Tente de novo.";
  }
}

/** 1234 → "1,2 mil" */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(".", ",").replace(",0", "")} mil`;
  return `${(n / 1_000_000).toFixed(1).replace(".", ",").replace(",0", "")} mi`;
}
