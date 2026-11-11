import "server-only";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/admin/format";

/** Só equipe entra no admin. Para quem não é da equipe a área nem existe (404). */
export async function requireStaff(next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  if (!isStaff(user.roles)) notFound();
  return user;
}
