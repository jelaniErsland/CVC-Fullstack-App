import sharp from "sharp";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";

// This adapter is deliberately local only. A production object store and its
// independently proven backup/restore path are an explicit deployment blocker.
export function localPhotoStorageEnabled(env: NodeJS.ProcessEnv = process.env) {
  try { return !env.VERCEL && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname); }
  catch { return false; }
}
function folder(workspace: string, asset: string) {
  if (!localPhotoStorageEnabled() || ![workspace, asset].every(v => /^[0-9a-f-]{36}$/.test(v))) throw new Error("Photo storage unavailable.");
  return path.join(process.cwd(), ".local", "project-assets", workspace, asset);
}
export async function encodeProjectPhoto(bytes: Uint8Array) {
  if (bytes.byteLength < 1 || bytes.byteLength > 6 * 1024 * 1024) throw new Error("Choose an image under 6 MB.");
  const source = sharp(bytes, { limitInputPixels: 24000000, failOn: "warning", animated: false });
  const meta = await source.metadata();
  if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || (meta.pages ?? 1) !== 1 || (meta.width ?? 0) < 400 || (meta.height ?? 0) < 200) throw new Error("Choose a still JPEG, PNG or WebP photo at least 400 × 200.");
  // Rotation honors orientation before re-encoding; EXIF/GPS/ICC are not copied.
  const desktop = await source.clone().rotate().resize({ width: 1600, height: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const mobile = await source.clone().rotate().resize({ width: 780, height: 900, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  return { desktop, mobile };
}
export async function writeProjectPhoto(workspace: string, asset: string, images: Awaited<ReturnType<typeof encodeProjectPhoto>>) {
  const target = folder(workspace, asset); await mkdir(target, { recursive: true });
  for (const size of ["desktop", "mobile"] as const) await writeFile(path.join(target, `${size}.webp`), images[size], { flag: "wx" });
}
export async function readProjectPhotoFile(workspace: string, asset: string, size: "desktop" | "mobile") {
  return readFile(path.join(folder(workspace, asset), `${size}.webp`));
}
export async function removeProjectPhotoFiles(workspace: string, asset: string) {
  // UUID-only path segments, confined to this adapter's local asset root.
  await rm(folder(workspace, asset), { recursive: true, force: true });
}
