import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMyStore } from "@/lib/market/queries";

/** Garante usuário logado com loja; senão redireciona. Usar dentro de <Suspense>. */
export async function requireStore(next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  const store = await getMyStore();
  if (!store) redirect("/vender");
  return store;
}
