import { describe, expect, it } from "vitest";
import { complaintErrorMessage, complaintWindowOpen, isReason, reasonLabel } from "@/lib/complaints/format";
import { CONTACT_MASK, CONTACT_WARNING } from "@/lib/contact/rule";

const day = 24 * 60 * 60 * 1000;

describe("Reclamações", () => {
  it("prazo: pago e enviado sempre; entregue até 30 dias", () => {
    const now = Date.parse("2026-11-15T12:00:00Z");
    expect(complaintWindowOpen("paid", null, now)).toBe(true);
    expect(complaintWindowOpen("shipped", null, now)).toBe(true);
    expect(complaintWindowOpen("delivered", new Date(now - 29 * day).toISOString(), now)).toBe(true);
    expect(complaintWindowOpen("delivered", new Date(now - 31 * day).toISOString(), now)).toBe(false);
    expect(complaintWindowOpen("pending_payment", null, now)).toBe(false);
    expect(complaintWindowOpen("cancelled", null, now)).toBe(false);
  });
  it("motivos e mensagens", () => {
    expect(isReason("damaged")).toBe(true);
    expect(isReason("xyz")).toBe(false);
    expect(reasonLabel.not_received).toBe("Não recebi o produto");
    expect(complaintErrorMessage("complaint_exists")).toContain("já abriu");
    expect(complaintErrorMessage("complaint_window_closed")).toContain("30 dias");
  });
});

describe("Contato fora da Zexi", () => {
  it("aviso explica a proibição", () => {
    expect(CONTACT_WARNING).toMatch(/proibido/);
    expect(CONTACT_WARNING).toMatch(/telefone, e-mail, links ou redes sociais/);
    expect(CONTACT_MASK).toBe("[contato oculto]");
  });
});
