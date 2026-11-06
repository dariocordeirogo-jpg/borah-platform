import { z } from "zod";
import { parseBRLToCents } from "@/lib/market/format";

const UF = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ",
  "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const addressSchema = z.object({
  recipient: z.string().trim().min(2, "Informe quem vai receber.").max(120),
  cep: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().length(8, "CEP deve ter 8 dígitos.")),
  street: z.string().trim().min(2, "Informe a rua.").max(160),
  number: z.string().trim().min(1, "Informe o número.").max(20),
  complement: z.string().trim().max(80).optional().transform((v) => v || null),
  district: z.string().trim().min(2, "Informe o bairro.").max(80),
  city: z.string().trim().min(2, "Informe a cidade.").max(80),
  state: z.string().trim().toUpperCase().pipe(z.enum(UF, { error: "Escolha a UF." })),
});
export const UFS = UF;

export const storeSchema = z.object({
  name: z.string().trim().min(3, "O nome precisa ter pelo menos 3 letras.").max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/, "Use de 3 a 50 letras minúsculas, números e hífens."),
  description: z.string().trim().max(600, "Máximo de 600 caracteres.").optional().transform((v) => v || null),
});

const money = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const cents = parseBRLToCents(v);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: `${label} inválido. Ex.: 199,90` });
        return z.NEVER;
      }
      return cents;
    });

export const productSchema = z
  .object({
    title: z.string().trim().min(3, "O título precisa ter pelo menos 3 letras.").max(120),
    description: z.string().trim().max(5000).optional().transform((v) => v || null),
    categoryId: z.coerce.number().int().positive("Escolha a categoria."),
    condition: z.enum(["new", "used", "refurbished"]),
    price: money("Preço").pipe(z.number().min(100, "Preço mínimo: R$ 1,00.").max(100_000_000)),
    compareAt: z
      .string()
      .trim()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        const cents = parseBRLToCents(v);
        if (cents === null) {
          ctx.addIssue({ code: "custom", message: "Preço anterior inválido." });
          return z.NEVER;
        }
        return cents;
      }),
    stock: z.coerce.number().int("Estoque deve ser um número inteiro.").min(0).max(100000),
    status: z.enum(["draft", "active", "paused"]),
  })
  .refine((d) => d.compareAt === null || d.compareAt > d.price, {
    path: ["compareAt"],
    message: "O preço anterior precisa ser maior que o preço atual.",
  });
