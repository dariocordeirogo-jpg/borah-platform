import { NextResponse } from "next/server";
import { isReferralCode, REF_COOKIE } from "@/lib/affiliates/format";
import { createAnonClient } from "@/lib/supabase/anon";
import { safeNextPath } from "@/lib/validation";

/**
 * Link de indicação: conta o clique, guarda o código num cookie (30 dias, último clique vale)
 * e leva para a página indicada. Código inválido só redireciona.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const url = new URL(request.url);
  const to = safeNextPath(url.searchParams.get("to"), "/");
  const response = NextResponse.redirect(new URL(to, url.origin), 307);
  if (!isReferralCode(code)) return response;

  const supabase = createAnonClient();
  const [{ data: valid }, { data: program }] = await Promise.all([
    supabase.rpc("track_referral", { _code: code }),
    supabase.rpc("affiliate_program"),
  ]);
  if (valid === true) {
    const days = (program as { cookie_days?: number } | null)?.cookie_days ?? 30;
    response.cookies.set(REF_COOKIE, code.toLowerCase(), {
      maxAge: days * 24 * 60 * 60,
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      path: "/",
    });
  }
  return response;
}
