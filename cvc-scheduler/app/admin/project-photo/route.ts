import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { readAdminProjectPhoto } from "@/lib/projectPhoto/server";
import { encodeProjectPhoto, readProjectPhotoFile, writeProjectPhoto, removeProjectPhotoFiles } from "@/lib/projectPhoto/files.server";
import { parseProjectPhoto } from "@/lib/projectPhoto/photo";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host") || request.headers.get("sec-fetch-site") === "cross-site") return Response.json({ error: "Unavailable." }, { status: 403 });
  try {
    const current = await readAdminProjectPhoto();
    if (!current?.canEdit) return Response.json({ error: "Photo changes are unavailable." }, { status: 403 });
    const reader = request.body?.getReader(); if (!reader) throw new Error();
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > 6 * 1024 * 1024 + 16000) { await reader.cancel(); return Response.json({ error: "Choose an image under 6 MB." }, { status: 413 }); } chunks.push(next.value); }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
    const command = form.get("command"); if (command !== "save" && command !== "remove") throw new Error();
    const version = Number(form.get("version")); if (!Number.isSafeInteger(version) || version !== current.photo.version) return Response.json({ error: "Project photo changed. Refresh and review the latest version." }, { status: 409 });
    const crop = { desktopX: Number(form.get("desktopX")), desktopY: Number(form.get("desktopY")), mobileX: Number(form.get("mobileX")), mobileY: Number(form.get("mobileY")) };
    if (Object.values(crop).some(v => !Number.isInteger(v) || v < 0 || v > 100)) throw new Error();
    let asset = current.photo.asset_id;
    if (command === "remove") asset = null;
    else {
      const file = form.get("photo");
      if (file instanceof File && file.size) { const images = await encodeProjectPhoto(new Uint8Array(await file.arrayBuffer())); asset = randomUUID(); await writeProjectPhoto(current.context.workspace.id, asset, images); }
      else if (asset) await readProjectPhotoFile(current.context.workspace.id, asset, "desktop");
      else throw new Error();
    }
    const saved = await current.context.supabase.rpc("save_workspace_project_photo", { p_workspace_id: current.context.workspace.id, p_asset_id: asset as string, p_crop: crop, p_expected_version: version });
    // An uncertain RPC outcome must never delete a possibly published image.
    if (saved.error) return Response.json({ error: saved.error.code === "40001" ? "Project photo changed. Refresh and review it." : "Save could not be confirmed. Refresh the Overview before retrying." }, { status: 409 });
    const photo = parseProjectPhoto(saved.data);
    try { revalidatePath("/admin/dashboard"); revalidatePath("/v/schedule"); } catch { /* Persistence remains successful. */ }
    if (current.photo.asset_id && current.photo.asset_id !== asset) {
      try { await removeProjectPhotoFiles(current.context.workspace.id, current.photo.asset_id); } catch { /* Detached local asset is safe for later cleanup. */ }
    }
    return Response.json({ photo }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Photo could not be saved. Use a still JPEG, PNG or WebP under 6 MB, at least 400 × 200." }, { status: 400 }); }
}
