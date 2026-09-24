import "server-only";
import { readOverviewRouteContext } from "@/lib/overview/routeRead.server";
import { localPhotoStorageEnabled } from "./files.server";
import { defaultPhoto, parseProjectPhoto } from "./photo";
export async function readAdminProjectPhoto() {
  const context = await readOverviewRouteContext();
  if (!context) return null;
  const result = await context.supabase.rpc("read_workspace_project_photo", { p_workspace_id: context.workspace.id });
  if (result.error) throw new Error("Project photo unavailable.");
  const photo = result.data ? parseProjectPhoto(result.data) : defaultPhoto;
  return { context, photo, canEdit: localPhotoStorageEnabled() && !!photo.uploads_enabled && context.capabilities.includes("calendar.edit") };
}
