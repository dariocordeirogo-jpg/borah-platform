import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { accountStatusFromV2, bpsToPercent, payErrorMessage, payoutLabel, payoutState, previewFee, stripeKeyMode } from "@/lib/pay/format";
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

describe("accountStatusFromV2 (Accounts v2 → situação da loja)", () => {
  const base = { id: "acct_1LOJA", livemode: false, metadata: { store_id: "s1" } };

  it("conta nova: sem vender, sem receber e com pendências da loja", () => {
    const s = accountStatusFromV2({
      ...base,
      configuration: { merchant: { capabilities: { card_payments: { status: "restricted" }, stripe_balance: { payouts: { status: "restricted" } } } } },
      requirements: {
        entries: [
          { awaiting_action_from: "user", description: "external_account", minimum_deadline: { status: "past_due" } },
          { awaiting_action_from: "user", description: "defaults.profile.product_description", minimum_deadline: { status: "currently_due" } },
          { awaiting_action_from: "user", description: "identity.individual.dob", minimum_deadline: { status: "eventually_due" } },
          { awaiting_action_from: "stripe", description: "revisão", minimum_deadline: { status: "currently_due" } },
        ],
      },
    });
    expect(s).toMatchObject({ id: "acct_1LOJA", charges_enabled: false, payouts_enabled: false, details_submitted: false, metadata: { store_id: "s1" } });
    expect(s.requirements.currently_due).toEqual(["external_account", "defaults.profile.product_description"]);
    expect(payoutState({ verified: true, ...s, requirements_due: s.requirements.currently_due })).toBe("pending");
  });

  it("conta pronta: vende e recebe", () => {
    const s = accountStatusFromV2({
      ...base,
      configuration: { merchant: { capabilities: { card_payments: { status: "active" }, stripe_balance: { payouts: { status: "active" } } } } },
      requirements: { entries: [] },
    });
    expect(s).toMatchObject({ charges_enabled: true, payouts_enabled: true, details_submitted: true });
    expect(payoutState({ verified: true, ...s, requirements_due: [] })).toBe("active");
  });

  it("sem configuração merchant: nada ativo", () => {
    expect(accountStatusFromV2(base)).toMatchObject({ charges_enabled: false, payouts_enabled: false, details_submitted: true, requirements: { currently_due: [] } });
  });
});

describe("Compra Garantida (repasse para a loja)", () => {
  it("mostra a situação do repasse", () => {
    expect(payoutLabel({ status: "succeeded", payout_status: "held" })).toBe("Retido até a entrega");
    expect(payoutLabel({ status: "succeeded", payout_status: "ready" })).toBe("Liberado · transferindo");
    expect(payoutLabel({ status: "succeeded", payout_status: "none" })).toBe("Na sua conta Stripe");
    expect(payoutLabel({ status: "refunded", payout_status: "cancelled" })).toBe("Devolvido ao comprador");
    expect(payoutLabel({ status: "created", payout_status: "none" })).toBe("—");
    expect(payoutLabel({ status: "succeeded", payout_status: "transferred", transferred_at: "2026-11-13T15:00:00Z" })).toBe(
      "Transferido em 13/11/2026",
    );
  });

  it("conta recebedora (transferências da Zexi) conta como recebimento ativo", () => {
    const s = accountStatusFromV2({
      id: "acct_1REC",
      livemode: false,
      configuration: {
        merchant: { capabilities: { card_payments: { status: "active" } } },
        recipient: { capabilities: { stripe_balance: { payouts: { status: "active" }, stripe_transfers: { status: "active" } } } },
      },
      requirements: { entries: [] },
    });
    expect(s.charges_enabled).toBe(true);
    expect(s.payouts_enabled).toBe(true);
  });

  it("explica quando a venda não pode mais ser devolvida", () => {
    expect(payErrorMessage("order_not_refundable")).toMatch(/não pode mais ser cancelada/);
  });
});
