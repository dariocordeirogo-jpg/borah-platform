"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { questionErrorMessage } from "@/lib/questions/format";
import { createClient } from "@/lib/supabase/server";

export type AskState = { error?: string; ok?: boolean };
const uuid = z.uuid();

export async function askQuestion(_prev: AskState, formData: FormData): Promise<AskState> {
  const productId = uuid.safeParse(formData.get("productId"));
  if (!productId.success) return { error: questionErrorMessage() };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(`/produto/${productId.data}#perguntas`)}`);
  const { error } = await supabase.rpc("ask_question", { _product_id: productId.data, _body: String(formData.get("body") ?? "").slice(0, 600) });
  if (error) return { error: questionErrorMessage(error.message) };
  revalidatePath(`/produto/${productId.data}`);
  return { ok: true };
}

const id = z.coerce.number().int().positive();

export async function answerQuestion(_prev: AskState, formData: FormData): Promise<AskState> {
  const qid = id.safeParse(formData.get("questionId"));
  if (!qid.success) return { error: questionErrorMessage() };
  const supabase = await createClient();
  const { error } = await supabase.rpc("answer_question", { _question_id: qid.data, _answer: String(formData.get("answer") ?? "").slice(0, 1100) });
  if (error) return { error: questionErrorMessage(error.message) };
  revalidatePath("/seller/perguntas");
  return { ok: true };
}

export async function hideQuestion(formData: FormData) {
  const qid = id.parse(formData.get("questionId"));
  const supabase = await createClient();
  await supabase.rpc("hide_question", { _question_id: qid });
  revalidatePath("/seller/perguntas");
}
