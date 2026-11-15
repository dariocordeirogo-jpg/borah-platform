import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Retorno do Google e dos links enviados por e-mail (confirmar conta, recuperar senha, trocar e-mail).
 * - `code` (fluxo PKCE): funciona quando o link é aberto no mesmo navegador do cadastro.
 * - `token_hash` + `type`: funciona em qualquer aparelho (ex.: cadastro no computador, link aberto no celular).
 * Confirmação de cadastro vai para a página "E-mail confirmado".
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));
  const supabase = await createClient();

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      if (type === "recovery") return NextResponse.redirect(new URL("/nova-senha", origin));
      if (type === "signup" || type === "email") return NextResponse.redirect(new URL(`/auth/confirmado?next=${encodeURIComponent(next)}`, origin));
      return NextResponse.redirect(new URL(next, origin));
    }
    return NextResponse.redirect(new URL("/auth/erro?motivo=link", origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Cadastro confirmado pelo link do e-mail (o cadastro manda next=/conta) → página de boas-vindas
      if (next === "/conta" && searchParams.get("origem") !== "google") {
        return NextResponse.redirect(new URL("/auth/confirmado?next=/conta", origin));
      }
      return NextResponse.redirect(new URL(next, origin));
    }
    return NextResponse.redirect(new URL("/auth/erro?motivo=link", origin));
  }

  // O Supabase devolve o erro na URL (ex.: link expirado, login com Google cancelado)
  const err = searchParams.get("error_code") ?? searchParams.get("error");
  const motivo = err === "otp_expired" ? "expirado" : err === "access_denied" ? "cancelado" : "link";
  return NextResponse.redirect(new URL(`/auth/erro?motivo=${motivo}`, origin));
}
