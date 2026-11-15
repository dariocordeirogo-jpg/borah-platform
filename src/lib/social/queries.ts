import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type SocialEvent = {
  id: number;
  platform: "tiktok" | "instagram";
  nickname: string;
  body: string;
  kind: "comment" | "link" | "bid" | "want";
  result: string | null;
};

/** Vínculos do usuário logado (RLS: só os próprios). */
export async function getMySocialLinks() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.from("social_links").select("platform, username, linked_at");
  return data ?? [];
}

/** Espelho dos comentários das redes enquanto a live está no ar (some quando a live termina). */
export async function getLiveSocialEvents(liveId: string): Promise<SocialEvent[]> {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase
    .from("live_social_events")
    .select("id, platform, nickname, body, kind, result")
    .eq("live_id", liveId)
    .order("id", { ascending: false })
    .limit(50);
  return ((data ?? []) as SocialEvent[]).reverse();
}
