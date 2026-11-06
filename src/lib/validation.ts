import { z } from "zod";

/** Limpa espaços e maiúsculas ANTES de validar (quem digita "Ana@x.com " não deve ser recusado). */
const emailField = z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido."));

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Informe sua senha."),
});

export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Seu nome precisa ter pelo menos 2 letras.")
    .max(80, "Nome muito longo."),
  email: emailField,
  password: z
    .string()
    .min(8, "A senha precisa ter pelo menos 8 caracteres.")
    .max(72, "A senha pode ter no máximo 72 caracteres.")
    .regex(/[A-Za-z]/, "Use pelo menos uma letra.")
    .regex(/[0-9]/, "Use pelo menos um número."),
  acceptTerms: z.literal("on", { error: "Você precisa aceitar os termos para criar a conta." }),
});

/** Só aceita caminhos internos, para evitar redirecionamento aberto (open redirect). */
export function safeNextPath(value: unknown, fallback = "/conta"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
