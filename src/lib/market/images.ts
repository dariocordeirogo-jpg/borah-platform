import { env } from "@/lib/env";

export const PRODUCT_IMAGE_BUCKET = "product-images";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGES_PER_PRODUCT = 8;

export function productImageUrl(path: string): string {
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${path}`;
}
