import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, hasAccess, isOpenPath, siteLocked } from "@/lib/site-lock";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Site em construção: sem o cookie de acesso, tudo vai para a página da senha
  if (siteLocked() && !isOpenPath(request.nextUrl.pathname)) {
    if (!(await hasAccess(request.cookies.get(ACCESS_COOKIE)?.value))) {
      const url = request.nextUrl.clone();
      url.pathname = "/em-construcao";
      url.search = "";
      const next = request.nextUrl.pathname + request.nextUrl.search;
      if (next !== "/") url.searchParams.set("next", next);
      return NextResponse.redirect(url);
    }
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
