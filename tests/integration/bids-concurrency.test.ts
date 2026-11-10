/**
 * Concorrência no motor de lances, contra o banco de desenvolvimento.
 * Dois compradores disparam lances ao mesmo tempo. Garantias:
 *  - cada valor aceito supera o anterior pelo menos no incremento (nunca dois lances aceitos no mesmo valor);
 *  - o maior lance do leilão = último lance aceito; contador de lances = lances gravados.
 * Usa reserva alta para o leilão terminar sem vencedor (não gera inadimplência para os usuários de teste).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://elygbieuroidqxkifgou.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_q6ee6uIuN9A8l8ni8wfngQ_NZc5L7Vn";
type Client = SupabaseClient<Database>;

async function signIn(email: string) {
  const c = createClient<Database>(URL, KEY, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: "Teste12345" });
  if (error || !data.user) throw new Error(`login ${email}: ${error?.message}`);
  return { c, id: data.user.id };
}

describe("lances concorrentes", () => {
  let seller: { c: Client; id: string };
  let buyers: { c: Client; id: string }[];
  let productId: string;

  beforeAll(async () => {
    seller = await signIn("e2e-vendedor@livelance.test");
    const { data: store } = await seller.c.from("stores").select("id").eq("owner_id", seller.id).single();
    if (!store) throw new Error("vendedor de teste sem loja");
    const { data: p, error } = await seller.c
      .from("products")
      .insert({ store_id: store.id, title: `Lote concorrência ${Date.now()}`, price_cents: 5000, stock: 1, status: "paused" })
      .select("id")
      .single();
    if (error) throw error;
    productId = p.id;
    buyers = [];
    const cpfs: Record<string, string> = { "e2e@livelance.test": "52998224725", "e2e-comprador2@livelance.test": "11144477735" };
    for (const email of Object.keys(cpfs)) {
      const b = await signIn(email);
      const { error: vErr } = await b.c.rpc("submit_verification", { _cpf: cpfs[email], _phone: "11988887777" });
      if (vErr) throw new Error(`verificação ${email}: ${vErr.message}`);
      buyers.push(b);
    }
  });

  afterAll(async () => {
    // estoque reservado volta quando o leilão termina sem vencedor (reserva alta)
    await seller.c.from("products").update({ status: "paused" }).eq("id", productId);
  });

  it("20 lances simultâneos mantêm a sequência consistente", async () => {
    const { data: auctionId, error } = await seller.c.rpc("create_auction", {
      _product_id: productId,
      _starting_cents: 1000,
      _increment_cents: 100,
      _reserve_cents: 99_999_900,
      _starts_at: null,
      _duration_minutes: 60,
    });
    if (error || !auctionId) throw error;

    // cada comprador tenta 10 lances; todos miram no "mínimo atual" lido antes de disparar
    const attempts = await Promise.all(
      Array.from({ length: 20 }, async (_, i) => {
        const b = buyers[i % 2];
        const { data: a } = await b.c.from("auctions").select("current_price_cents").eq("id", auctionId).single();
        const min = a?.current_price_cents == null ? 1000 : a.current_price_cents + 100;
        return b.c.rpc("place_bid", { _auction_id: auctionId, _amount_cents: min, _idempotency_key: `conc-${Date.now()}-${i}` });
      }),
    );
    const accepted = attempts.filter((r) => !r.error).length;
    const rejected = attempts.filter((r) => r.error);
    for (const r of rejected) expect(r.error?.message).toMatch(/bid_too_low|already_leading/);

    const { data: bids } = await seller.c.from("auction_bids").select("id, amount_cents, bidder_id").eq("auction_id", auctionId).order("id");
    const { data: auction } = await seller.c.from("auctions").select("current_price_cents, bids_count, leader_id").eq("id", auctionId).single();

    expect(bids!.length).toBe(accepted);
    expect(auction!.bids_count).toBe(accepted);
    for (let i = 1; i < bids!.length; i++) {
      expect(bids![i].amount_cents - bids![i - 1].amount_cents).toBeGreaterThanOrEqual(100);
      expect(bids![i].bidder_id).not.toBe(bids![i - 1].bidder_id); // ninguém cobre o próprio lance
    }
    expect(auction!.current_price_cents).toBe(bids!.at(-1)!.amount_cents);
    expect(auction!.leader_id).toBe(bids!.at(-1)!.bidder_id);
    expect(accepted).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
