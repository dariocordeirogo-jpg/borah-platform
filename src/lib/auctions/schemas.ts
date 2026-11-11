import { z } from "zod";
import { durationOptions, isValidCPF } from "@/lib/auctions/format";
import { parseBRLToCents } from "@/lib/market/format";

export const verificationSchema = z.object({
  cpf: z.string().refine(isValidCPF, "CPF inválido. Confira os números."),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""))
    .pipe(z.string().regex(/^[1-9]\d\d{8,9}$/, "Telefone inválido. Use DDD + número.")),
  consent: z.literal("on", { error: "É preciso concordar com as regras dos leilões." }),
});

const money = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const c = parseBRLToCents(v);
      if (c === null) {
        ctx.addIssue({ code: "custom", message: `${label} inválido. Ex.: 150,00` });
        return z.NEVER;
      }
      return c;
    });

/** "2026-11-12T20:30" digitado no horário de Brasília → ISO UTC. Brasil sem horário de verão desde 2019. */
export function brasiliaLocalToISO(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const d = new Date(`${local}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const auctionSchema = z
  .object({
    productId: z.uuid({ error: "Escolha o produto." }),
    startingPrice: money("Lance inicial").pipe(z.number().min(100, "Lance inicial mínimo: R$ 1,00.")),
    increment: money("Incremento").pipe(z.number().min(100, "Incremento mínimo: R$ 1,00.")),
    reserve: z
      .string()
      .trim()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        const c = parseBRLToCents(v);
        if (c === null) {
          ctx.addIssue({ code: "custom", message: "Preço de reserva inválido." });
          return z.NEVER;
        }
        return c;
      }),
    startMode: z.enum(["now", "scheduled"]),
    startsAt: z.string().optional(),
    duration: z.coerce
      .number()
      .refine((m) => durationOptions.some((o) => o.minutes === m), "Escolha a duração."),
  })
  .refine((d) => d.reserve === null || d.reserve >= d.startingPrice, {
    path: ["reserve"],
    message: "A reserva não pode ser menor que o lance inicial.",
  })
  .transform((d, ctx) => {
    let startsAtISO: string | null = null;
    if (d.startMode === "scheduled") {
      startsAtISO = d.startsAt ? brasiliaLocalToISO(d.startsAt) : null;
      if (!startsAtISO || new Date(startsAtISO).getTime() < Date.now()) {
        ctx.addIssue({ code: "custom", path: ["startsAt"], message: "Escolha uma data e hora no futuro." });
        return z.NEVER;
      }
    }
    return { ...d, startsAtISO };
  });
