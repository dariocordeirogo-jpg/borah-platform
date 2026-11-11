/**
 * Concorrência no fechamento de pedido, contra o banco de desenvolvimento.
 * Dois compradores disputam a última unidade ao mesmo tempo: exatamente um pedido pode ser criado.
 * Rodar com: npm run test:integration  (atrás de proxy: NODE_USE_ENV_PROXY=1)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://elygbieuroidqxkifgou.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_q6ee6uIuN9A8l8ni8wfngQ_NZc5L7Vn";
const PASSWORD = "Teste12345";
const ROUNDS = 5;

type Client = SupabaseClient<Database>;
async function signIn(email: string) {
  const c = createClient<Database>(URL, KEY, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.user) throw new Error(`login ${email}: ${error?.message}`);
  return { c, id: data.user.id };
}

async function ensureAddress(b: { c: Client; id: string }) {
  const { data } = await b.c.from("addresses").select("id").eq("user_id", b.id).limit(1);
  if (data?.[0]) return data[0].id;
  const { data: created, error } = await b.c
    .from("addresses")
    .insert({ user_id: b.id, recipient: "Teste", cep: "01001000", street: "Praça da Sé", number: "1", district: "Sé", city: "São Paulo", state: "SP" })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

describe("checkout concorrente", () => {
  let seller: { c: Client; id: string };
  let buyers: { c: Client; id: string; addr: string }[];
  let storeId: string;
  const created: { productId: string; orderIds: string[] }[] = [];

  beforeAll(async () => {
    seller = await signIn("e2e-vendedor@livelance.test");
    const { data: store } = await seller.c.from("stores").select("id").eq("owner_id", seller.id).single();
    if (!store) throw new Error("vendedor de teste sem loja (rode os testes e2e antes)");
    storeId = store.id;
    buyers = [];
    for (const email of ["e2e@livelance.test", "e2e-comprador2@livelance.test"]) {
      const b = await signIn(email);
      buyers.push({ ...b, addr: await ensureAddress(b) });
    }
  });

  afterAll(async () => {
    for (const r of created) {
      for (const o of r.orderIds) await seller.c.rpc("cancel_order", { _order_id: o, _reason: "Limpeza do teste" });
      await seller.c.from("products").update({ status: "paused" }).eq("id", r.productId);
    }
    for (const b of buyers ?? []) await b.c.from("cart_items").delete().eq("user_id", b.id);
  });

  it(`em ${ROUNDS} disputas pela última unidade, só um pedido é criado e o estoque nunca fica negativo`, async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const { data: p, error } = await seller.c
        .from("products")
        .insert({ store_id: storeId, title: `Concorrência ${Date.now()}-${round}`, price_cents: 1000, stock: 1, status: "active" })
        .select("id")
        .single();
      if (error) throw error;
      const record = { productId: p.id, orderIds: [] as string[] };
      created.push(record);

      for (const b of buyers) {
        await b.c.from("cart_items").delete().eq("user_id", b.id);
        await b.c.from("cart_items").insert({ user_id: b.id, product_id: p.id, quantity: 1 });
      }

      const results = await Promise.all(buyers.map((b) => b.c.rpc("checkout", { _address_id: b.addr })));
      const ok = results.filter((r) => !r.error && r.data?.length);
      const failed = results.filter((r) => r.error);
      record.orderIds = ok.flatMap((r) => r.data ?? []);

      expect(ok, `rodada ${round}`).toHaveLength(1);
      expect(failed, `rodada ${round}`).toHaveLength(1);
      expect(failed[0].error?.message).toMatch(/insufficient_stock/);

      const { data: after } = await seller.c.from("products").select("stock").eq("id", p.id).single();
      expect(after?.stock).toBe(0);
    }
  }, 60_000);
});
