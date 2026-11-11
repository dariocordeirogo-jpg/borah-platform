import { env } from "@/lib/env";
import { VIDEO_BUCKET } from "@/lib/videos/format";

export function videoUrl(path: string): string {
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${VIDEO_BUCKET}/${path}`;
}
