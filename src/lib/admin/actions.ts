"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminErrorMessage, isReportKind, reportReasons } from "@/lib/admin/format";
import { retireLiveStream } from "@/lib/live/stream";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation";

const uuid = z.uuid();
const reason = (fd: FormData) => String(fd.get("reason") ?? "").trim();

function back(path: string, error?: string): never {
  revalidatePath("/admin", "layout");
  redirect(`${path}${error ? `?erro=${encodeURIComponent(error)}` : "?ok=1"}`);
}

/** Usuário denuncia um item. */
export async function reportContent(formData: FormData) {
  const kind = formData.get("kind");
  const targetId = String(formData.get("targetId") ?? "");
  const why = String(formData.get("why") ?? "");
  const details = String(formData.get("details") ?? "").trim();
  const next = safeNextPath(formData.get("next"), "/");
  const self = `/denunciar?tipo=${kind}&id=${encodeURIComponent(targetId)}&next=${encodeURIComponent(next)}`;
  if (!isReportKind(kind) || !targetId || targetId.length > 64) redirect(`${self}&erro=${encodeURIComponent(adminErrorMessage("target_not_found"))}`);
  if (!(why in reportReasons)) redirect(`${self}&erro=${encodeURIComponent("Escolha o motivo da denúncia.")}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_content", { _kind: kind, _target_id: targetId, _reason: why, _details: details || null });
  if (error) redirect(`${self}&erro=${encodeURIComponent(adminErrorMessage(error.message))}`);
  redirect(`${self}&enviado=1`);
}

/** Fila de denúncias: agir no item (e marcar como resolvida) ou descartar. */
export async function actOnReport(formData: FormData) {
  const reportId = uuid.parse(formData.get("reportId"));
  const kind = formData.get("kind");
  const targetId = String(formData.get("targetId") ?? "");
  const decision = formData.get("decision");
  const note = reason(formData);
  const supabase = await createClient();
  if (decision === "act" && isReportKind(kind)) {
    const { error } =
      kind === "product"
        ? await supabase.rpc("admin_block_product", { _product_id: targetId, _reason: note })
        : kind === "video"
          ? await supabase.rpc("admin_remove_video", { _video_id: targetId, _reason: note })
          : kind === "live"
            ? await supabase.rpc("admin_end_live", { _live_id: targetId, _reason: note })
            : kind === "store"
              ? await supabase.rpc("admin_set_store_active", { _store_id: targetId, _active: false, _reason: note })
              : await supabase.rpc("admin_hide_message", { _message_id: Number(targetId) });
    // "not_found" aqui = o item já tinha sido tratado; a denúncia pode ser fechada mesmo assim
    if (error && !error.message.startsWith("not_found")) back("/admin/denuncias", adminErrorMessage(error.message));
    if (kind === "live") await retireLiveStream(supabase, targetId);
  }
  const { error } = await supabase.rpc("admin_resolve_report", {
    _report_id: reportId,
    _status: decision === "act" ? "actioned" : "dismissed",
    _note: note || null,
  });
  back("/admin/denuncias", error ? adminErrorMessage(error.message) : undefined);
}

export async function blockProduct(formData: FormData) {
  const id = uuid.parse(formData.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_block_product", { _product_id: id, _reason: reason(formData) });
  back("/admin/moderacao", error ? adminErrorMessage(error.message) : undefined);
}

export async function unblockProduct(formData: FormData) {
  const id = uuid.parse(formData.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_unblock_product", { _product_id: id });
  back("/admin/moderacao", error ? adminErrorMessage(error.message) : undefined);
}

export async function removeVideoAdmin(formData: FormData) {
  const id = uuid.parse(formData.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_remove_video", { _video_id: id, _reason: reason(formData) });
  back("/admin/moderacao", error ? adminErrorMessage(error.message) : undefined);
}

export async function endLiveAdmin(formData: FormData) {
  const id = uuid.parse(formData.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_end_live", { _live_id: id, _reason: reason(formData) });
  if (!error) await retireLiveStream(supabase, id);
  back("/admin/moderacao", error ? adminErrorMessage(error.message) : undefined);
}

export async function setStoreActive(formData: FormData) {
  const id = uuid.parse(formData.get("id"));
  const active = formData.get("active") === "1";
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_store_active", { _store_id: id, _active: active, _reason: reason(formData) || null });
  back("/admin/lojas", error ? adminErrorMessage(error.message) : undefined);
}
