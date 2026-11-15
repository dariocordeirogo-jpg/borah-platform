import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseListing } from "@/lib/importer/parse";
import { ImportError, safeFetch } from "@/lib/importer/safe-fetch";
import { extensionFor, sniffImageType } from "@/lib/market/image-check";
import { MAX_IMAGE_BYTES, PRODUCT_IMAGE_BUCKET } from "@/lib/market/images";
import type { Database } from "@/lib/supabase/database.types";

/** Baixa uma foto do anúncio de origem (proteção contra rede interna) e confere a assinatura real do arquivo. */
export async function fetchImage(url: string) {
  const img = await safeFetch(url, {
    maxBytes: MAX_IMAGE_BYTES,
    accept: "image/webp,image/jpeg,image/png;q=0.9",
    timeoutMs: 15_000,
    allowTypes: (t) => t === "" || t.startsWith("image/") || t === "application/octet-stream",
  });
  const type = sniffImageType(img.body);
  if (!type) throw new ImportError("bad_type");
  return { bytes: img.body, type };
}

/** Copia as fotos para o armazenamento da Zexi, na ordem. Foto que falhar é pulada (o produto continua). */
export async function saveImages(supabase: SupabaseClient<Database>, storeId: string, productId: string, urls: string[]) {
  let ok = 0;
  let failed = 0;
  for (const url of urls) {
    try {
      const { bytes, type } = await fetchImage(url);
      const path = `${storeId}/${productId}/${randomUUID()}.${extensionFor[type]}`;
      const { error: upErr } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, bytes, { contentType: type, upsert: false });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("product_images").insert({ product_id: productId, path, position: ok });
      if (dbErr) {
        await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
        throw dbErr;
      }
      ok++;
    } catch {
      failed++;
    }
  }
  return { ok, failed };
}

const MAX_PAGE_BYTES = 3 * 1024 * 1024;

function decode(body: Uint8Array, contentType: string): string {
  const charset = contentType.match(/charset=([\w-]+)/i)?.[1]?.toLowerCase();
  try {
    return new TextDecoder(charset && charset !== "utf8" ? charset : "utf-8").decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

/** Lê o anúncio de um link (mesma proteção das fotos). null quando a página não traz dados de produto. */
export async function readListing(url: string) {
  const page = await safeFetch(url, {
    maxBytes: MAX_PAGE_BYTES,
    accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
    allowTypes: (t) => t === "" || t.includes("html") || t.includes("xml"),
  });
  return parseListing(decode(page.body, page.contentType), page.url.toString());
}
