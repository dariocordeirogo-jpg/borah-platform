import { describe, expect, it } from "vitest";
import { centsToInput, marketErrorMessage, parseBRLToCents, slugify } from "@/lib/market/format";
import { sniffImageType } from "@/lib/market/image-check";
import { addressSchema, productSchema, storeSchema } from "@/lib/market/schemas";

describe("parseBRLToCents", () => {
  it.each([
    ["199,90", 19990],
    ["1.299,90", 129990],
    ["R$ 49", 4900],
    ["1299.9", 129990],
    ["1.000", 100000],
    ["0,99", 99],
    [" 10 ", 1000],
  ])("%s → %i", (input, cents) => expect(parseBRLToCents(input)).toBe(cents));

  it.each(["", "abc", "1,999", "-5", "1.2.3", "10,5,0"])("recusa %s", (input) => expect(parseBRLToCents(input)).toBeNull());

  it("ida e volta com centsToInput", () => {
    expect(centsToInput(129990)).toBe("1299,90");
    expect(parseBRLToCents(centsToInput(129990))).toBe(129990);
    expect(centsToInput(null)).toBe("");
  });
});

describe("slugify", () => {
  it("remove acentos e símbolos", () => {
    expect(slugify("Loja do João & Cia!")).toBe("loja-do-joao-cia");
    expect(slugify("  Ação  Total  ")).toBe("acao-total");
  });
  it("limita a 50 caracteres sem hífen no fim", () => {
    const s = slugify("a".repeat(49) + " b c");
    expect(s.length).toBeLessThanOrEqual(50);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("sniffImageType (assinatura real do arquivo)", () => {
  it("reconhece JPEG, PNG e WebP", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    const webp = new TextEncoder().encode("RIFF____WEBPVP8 ");
    expect(sniffImageType(webp)).toBe("image/webp");
  });
  it("recusa HTML/SVG/PDF disfarçados", () => {
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
  });
});

describe("marketErrorMessage", () => {
  it("traduz erros do banco", () => {
    expect(marketErrorMessage("insufficient_stock:Fone")).toContain("Estoque insuficiente");
    expect(marketErrorMessage("own_product:Fone")).toContain("sua própria loja");
    expect(marketErrorMessage('duplicate key value violates unique constraint "stores_slug_key"')).toContain("já está em uso");
    expect(marketErrorMessage("qualquer outra coisa")).toContain("Tente de novo");
  });
});

describe("schemas", () => {
  const product = { title: "Fone", categoryId: "1", condition: "new", price: "199,90", compareAt: "", stock: "3", status: "active" };
  it("produto válido vira centavos", () => {
    const r = productSchema.safeParse(product);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.price).toBe(19990);
      expect(r.data.compareAt).toBeNull();
    }
  });
  it("preço anterior precisa ser maior", () => {
    expect(productSchema.safeParse({ ...product, compareAt: "100,00" }).success).toBe(false);
    expect(productSchema.safeParse({ ...product, compareAt: "249,90" }).success).toBe(true);
  });
  it("recusa preço abaixo de R$ 1 e estoque negativo", () => {
    expect(productSchema.safeParse({ ...product, price: "0,50" }).success).toBe(false);
    expect(productSchema.safeParse({ ...product, stock: "-1" }).success).toBe(false);
  });
  it("endereço normaliza CEP e UF", () => {
    const r = addressSchema.safeParse({ recipient: "Ana", cep: "01001-000", street: "Praça", number: "1", district: "Sé", city: "SP", state: "sp" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cep).toBe("01001000");
      expect(r.data.state).toBe("SP");
    }
    expect(addressSchema.safeParse({ recipient: "Ana", cep: "123", street: "x", number: "1", district: "y", city: "z", state: "XX" }).success).toBe(false);
  });
  it("slug da loja", () => {
    expect(storeSchema.safeParse({ name: "Loja", slug: "loja-boa" }).success).toBe(true);
    expect(storeSchema.safeParse({ name: "Loja", slug: "-ruim" }).success).toBe(false);
    expect(storeSchema.safeParse({ name: "Loja", slug: "Com Espaço" }).success).toBe(false);
  });
});

describe("peso do produto", () => {
  const base = { title: "Tênis", categoryId: "1", condition: "new", price: "199,90", stock: "3", status: "active" };
  it("sem peso usa 500 g; acima de 30 kg é recusado", async () => {
    const { productSchema } = await import("@/lib/market/schemas");
    const ok = productSchema.safeParse(base);
    expect(ok.success && ok.data.weight).toBe(500);
    expect(productSchema.safeParse({ ...base, weight: "800" }).success).toBe(true);
    expect(productSchema.safeParse({ ...base, weight: "40000" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, weight: "1,5" }).success).toBe(false);
  });
});
