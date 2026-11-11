import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { bpsToPercent, payErrorMessage, payoutState, previewFee, stripeKeyMode } from "@/lib/pay/format";
import { signStripePayload } from "@/lib/pay/signature";

describe("assinatura dos avisos", () => {
  const secret = "whsec_teste_0123456789abcdef";
  const payload = JSON.stringify({ id: "evt_1", type: "account.updated", data: { object: { nome: "João & Cia ✓" } } });

  it("igual à da biblioteca oficial da Stripe", () => {
    const stripe = new Stripe("sk_test_x");
    const ts = 1_800_000_000;
    expect(signStripePayload(payload, secret, ts)).toBe(stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp: ts }));
  });

  it("a Stripe aceita a assinatura gerada", () => {
    const stripe = new Stripe("sk_test_x");
    const header = signStripePayload(payload, secret);
    expect(stripe.webhooks.constructEvent(payload, header, secret).id).toBe("evt_1");
  });
});

describe("chave Stripe", () => {
  it.each([
    ["sk_test_abc", "test"],
    ["rk_test_abc", "test"],
    ["sk_live_abc", "live"],
    ["rk_live_abc", "live"],
    ["pk_test_abc", null],
    ["", null],
    [undefined, null],
  ])("%s → %s", (key, mode) => expect(stripeKeyMode(key)).toBe(mode));
});

describe("comissão e textos", () => {
  it("percentual", () => {
    expect(bpsToPercent(1000)).toBe("10%");
    expect(bpsToPercent(1250)).toBe("12,5%");
    expect(bpsToPercent(0)).toBe("0%");
  });
  it("prévia da comissão em centavos", () => {
    expect(previewFee(20000, 1000)).toBe(2000);
    expect(previewFee(999, 1000)).toBe(100);
  });
  it("situação da conta de recebimento", () => {
    const base = { verified: true, charges_enabled: true, payouts_enabled: true, details_submitted: true, requirements_due: [] };
    expect(payoutState(null)).toBe("none");
    expect(payoutState({ ...base, verified: false })).toBe("pending");
    expect(payoutState({ ...base, requirements_due: ["external_account"] })).toBe("restricted");
    expect(payoutState(base)).toBe("active");
  });
  it("erros do banco", () => {
    expect(payErrorMessage("store_cannot_receive")).toMatch(/ativando os recebimentos/);
    expect(payErrorMessage("payment_processing")).toMatch(/Pix ou boleto/);
    expect(payErrorMessage("qualquer")).toMatch(/Tente de novo/);
  });
});
