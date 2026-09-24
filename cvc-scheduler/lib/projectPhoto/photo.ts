export type ProjectPhoto = { asset_id: string | null; version: number; desktop_x: number; desktop_y: number; mobile_x: number; mobile_y: number; uploads_enabled?: boolean };
export const defaultPhoto: ProjectPhoto = { asset_id: null, version: 0, desktop_x: 50, desktop_y: 50, mobile_x: 50, mobile_y: 50, uploads_enabled: false };
export function parseProjectPhoto(value: unknown): ProjectPhoto {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultPhoto;
  const p = value as Record<string, unknown>;
  if (p.asset_id !== null && (typeof p.asset_id !== "string" || !/^[a-f0-9-]{36}$/.test(p.asset_id))) throw new Error("Invalid project photo.");
  for (const key of ["desktop_x", "desktop_y", "mobile_x", "mobile_y"]) if (typeof p[key] !== "number" || !Number.isInteger(p[key]) || p[key] < 0 || p[key] > 100) throw new Error("Invalid photo crop.");
  if (typeof p.version !== "number" || !Number.isSafeInteger(p.version) || p.version < 0) throw new Error("Invalid photo version.");
  return p as ProjectPhoto;
}
export function projectPhotoUrl(asset: string, size: "desktop" | "mobile") { return `/v/project-photo/${asset}/${size}`; }
