"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, ACCESS_MAX_AGE, accessToken, safeNext } from "@/lib/site-lock";

/** Confere a senha de acesso interno no servidor e libera o site neste navegador. */
export async function unlockSite(formData: FormData) {
  const expected = process.env.SITE_ACCESS_PASSWORD;
  const next = safeNext(formData.get("next"));
  if (!expected) redirect(next);
  const given = String(formData.get("password") ?? "").trim().slice(0, 64);
  const [a, b] = await Promise.all([accessToken(given), accessToken(expected)]);
  if (a !== b) {
    // Atraso em toda tentativa errada: dificulta tentar senhas em sequência
    await new Promise((r) => setTimeout(r, 1200));
    redirect(`/em-construcao?erro=1${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`);
  }
  (await cookies()).set(ACCESS_COOKIE, b, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE,
  });
  redirect(next);
}
