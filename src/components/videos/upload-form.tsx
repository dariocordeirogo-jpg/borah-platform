"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Upload } from "lucide-react";
import { Notice } from "@/components/market";
import { Button } from "@/components/ui/button";
import { getBrowserClient } from "@/lib/supabase/client";
import { createVideo } from "@/lib/videos/actions";
import { checkVideoFile, VIDEO_BUCKET, VIDEO_TYPES, type VideoType } from "@/lib/videos/format";

const field = "h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink";

/**
 * O arquivo vai direto do navegador para o Storage (pasta da loja, protegida por RLS) e
 * só depois o servidor registra o vídeo — assim vídeos grandes não passam pelo servidor.
 */
export function VideoUploadForm({ storeId, products }: { storeId: string; products: { id: string; title: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    const productId = String(form.get("productId") ?? "");
    const caption = String(form.get("caption") ?? "");
    if (!productId) return setError("Escolha o produto marcado no vídeo.");
    if (!(file instanceof File) || !file.name) return setError("Escolha o arquivo do vídeo.");
    const problem = checkVideoFile(file);
    if (problem) return setError(problem);

    setBusy(true);
    const path = `${storeId}/${crypto.randomUUID()}.${VIDEO_TYPES[file.type as VideoType]}`;
    const { error: upErr } = await getBrowserClient()
      .storage.from(VIDEO_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setBusy(false);
      return setError("Não foi possível enviar o arquivo. Confira a conexão e tente de novo.");
    }
    const res = await createVideo({ productId, path, caption });
    if (res.error) {
      setBusy(false);
      return setError(res.error);
    }
    router.push("/seller/videos?novo=1");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-navy">Produto marcado</span>
        <select name="productId" className={field} defaultValue="">
          <option value="" disabled>
            Escolha um produto
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-navy">Legenda (opcional)</span>
        <textarea name="caption" maxLength={300} rows={3} className={`${field} h-auto py-2`} placeholder="Conte o que aparece no vídeo" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-navy">Arquivo do vídeo</span>
        <input
          name="file"
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-navy-soft file:px-4 file:py-2 file:font-semibold file:text-navy"
        />
        <span className="mt-1 block text-xs text-muted">MP4, WebM ou MOV, até 50 MB. Vídeos verticais ficam melhores no feed.</span>
      </label>
      <Button type="submit" disabled={busy}>
        <Upload className="h-4 w-4" aria-hidden="true" /> {busy ? "Enviando..." : "Publicar vídeo"}
      </Button>
    </form>
  );
}
