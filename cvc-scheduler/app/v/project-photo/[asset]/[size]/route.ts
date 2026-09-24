import { readAdminProjectPhoto } from "@/lib/projectPhoto/server";
import { readProjectPhotoFile } from "@/lib/projectPhoto/files.server";
import { readVolunteerHome } from "@/lib/volunteerScheduleAccess/home.server";
export async function GET(_request: Request, context: { params: Promise<{ asset: string; size: string }> }) {
  const { asset, size } = await context.params;
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
  if (!/^[a-f0-9-]{36}$/.test(asset) || !["desktop", "mobile"].includes(size)) return new Response(null, { status: 404, headers });
  try {
    let scope: string | undefined;
    const volunteer = await readVolunteerHome(new Date().toISOString().slice(0, 10));
    if (volunteer?.photo.asset_id === asset) scope = volunteer.photo.asset_scope;
    if (!scope) { const admin = await readAdminProjectPhoto(); if (admin?.photo.asset_id === asset) scope = admin.context.workspace.id; }
    if (!scope) return new Response(null, { status: 404, headers });
    const file = await readProjectPhotoFile(scope, asset, size as "desktop" | "mobile");
    return new Response(new Uint8Array(file), { headers: { ...headers, "Content-Type": "image/webp" } });
  } catch { return new Response(null, { status: 404, headers }); }
}
