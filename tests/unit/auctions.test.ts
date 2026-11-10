import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auctionErrorMessage, formatPhoneBR, isValidCPF } from "@/lib/auctions/format";
import { auctionSchema, brasiliaLocalToISO, verificationSchema } from "@/lib/auctions/schemas";

describe("isValidCPF (mesma regra do banco)", () => {
  it.each(["529.982.247-25", "52998224725", "111.444.777-35"])("aceita %s", (c) => expect(isValidCPF(c)).toBe(true));
  it.each(["123.456.789-00", "111.111.111-11", "000.000.000-00", "5299822472", "529.982.247-26", ""])("recusa %s", (c) =>
    expect(isValidCPF(c)).toBe(false),
  );
});

describe("verificationSchema", () => {
  it("normaliza celular com ou sem +55", () => {
    const r = verificationSchema.safeParse({ cpf: "529.982.247-25", phone: "+55 (11) 98888-7777", consent: "on" });
    expect(r.success && r.data.phone).toBe("11988887777");
  });
  it("exige consentimento com as regras", () => {
    expect(verificationSchema.safeParse({ cpf: "529.982.247-25", phone: "11988887777" }).success).toBe(false);
  });
  it("recusa celular sem DDD", () => {
    expect(verificationSchema.safeParse({ cpf: "529.982.247-25", phone: "98888-7777", consent: "on" }).success).toBe(false);
  });
});

describe("brasiliaLocalToISO", () => {
  it("converte horário de Brasília para UTC (UTC-3)", () => {
    expect(brasiliaLocalToISO("2026-11-12T20:30")).toBe("2026-11-12T23:30:00.000Z");
  });
  it("recusa formato inválido", () => {
    expect(brasiliaLocalToISO("12/11/2026 20:30")).toBeNull();
  });
});

describe("auctionSchema", () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date("2026-11-10T12:00:00Z")));
  afterEach(() => vi.useRealTimers());
  const base = {
    productId: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
    startingPrice: "100,00",
    increment: "10,00",
    reserve: "",
    startMode: "now",
    duration: "1440",
  };
  it("leilão imediato válido em centavos", () => {
    const r = auctionSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.startingPrice).toBe(10000);
      expect(r.data.increment).toBe(1000);
      expect(r.data.reserve).toBeNull();
      expect(r.data.startsAtISO).toBeNull();
    }
  });
  it("reserva menor que o lance inicial é recusada", () => {
    expect(auctionSchema.safeParse({ ...base, reserve: "50,00" }).success).toBe(false);
  });
  it("duração fora da lista é recusada", () => {
    expect(auctionSchema.safeParse({ ...base, duration: "5" }).success).toBe(false);
  });
  it("programado exige data futura", () => {
    expect(auctionSchema.safeParse({ ...base, startMode: "scheduled", startsAt: "2026-11-09T10:00" }).success).toBe(false);
    const ok = auctionSchema.safeParse({ ...base, startMode: "scheduled", startsAt: "2026-11-12T20:30" });
    expect(ok.success && ok.data.startsAtISO).toBe("2026-11-12T23:30:00.000Z");
  });
});

describe("mensagens", () => {
  it("traduz erros do motor de lances com valores", () => {
    expect(auctionErrorMessage("bid_too_low:11000").replace(/\s/g, " ")).toBe("O lance mínimo agora é R$ 110,00.");
    expect(auctionErrorMessage("auction_banned")).toContain("não confirmou um arremate");
    expect(auctionErrorMessage("bid_blocked")).toContain("temporariamente");
    expect(auctionErrorMessage("xyz")).toContain("Tente de novo");
  });
  it("formata celular", () => {
    expect(formatPhoneBR("+5511988887777")).toBe("(11) 98888-7777");
    expect(formatPhoneBR("+551133334444")).toBe("(11) 3333-4444");
  });
});
