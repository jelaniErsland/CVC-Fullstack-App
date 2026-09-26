import type { CSSProperties, ReactNode } from "react";
import { projectPhotoUrl, type ProjectPhoto } from "@/lib/projectPhoto/photo";
import { ldcProjectName } from "@/lib/projectIdentity";
export function ProjectHero({ photo, title, projectName, children, previewUrl, previewSize, compact = false }: { compact?: boolean; photo: ProjectPhoto; title: string; projectName: string; children?: ReactNode; previewUrl?: string; previewSize?: "desktop" | "mobile" }) {
  const Heading = compact ? "h2" : "h1";
  const hasPhoto = !!(previewUrl || photo.asset_id);
  const style = { "--hero-desktop": `${photo.desktop_x}% ${photo.desktop_y}%`, "--hero-mobile": `${photo.mobile_x}% ${photo.mobile_y}%` } as CSSProperties;
  return <section aria-label={compact ? "Project identity" : "Project hero"} style={style} className={`relative isolate flex flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 text-white ${previewSize ? `${previewSize === "desktop" ? "aspect-[4.6/1]" : "aspect-[2.5/1]"} p-3` : compact ? "h-[110px] p-4 sm:h-[150px] sm:p-5" : "min-h-36 p-5 sm:min-h-44 sm:p-6"}`}>
    {hasPhoto ? <picture className="absolute inset-0 -z-20">
      {!previewUrl && photo.asset_id && <source media="(max-width: 639px)" srcSet={projectPhotoUrl(photo.asset_id, "mobile")} />}
      {/* Protected, already-sized WebP derivatives must retain the session cookie. */}
      <img alt="" width={1600} height={1200} fetchPriority="high" src={previewUrl ?? projectPhotoUrl(photo.asset_id!, "desktop")} className={`h-full w-full object-cover ${previewSize === "mobile" ? "object-[var(--hero-mobile)]" : previewSize === "desktop" ? "object-[var(--hero-desktop)]" : "object-[var(--hero-mobile)] sm:object-[var(--hero-desktop)]"}`} />
    </picture> : <div aria-hidden className="absolute -right-12 -top-12 -z-20 size-72 rounded-full border-[32px] border-white/10"><div className="m-7 h-full w-full rounded-full border-[24px] border-teal-300/15" /></div>}
    <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/80 via-slate-950/55 to-slate-950/20" />
    <p className={`max-w-[85%] font-medium tracking-wide text-white/90 ${previewSize ? "text-[9px]" : "text-xs"}`}>{compact ? "Current project" : ldcProjectName(projectName)}</p>
    <Heading className={`max-w-[85%] break-words font-semibold tracking-tight ${previewSize ? "mt-1 text-sm" : compact ? "mt-1 text-lg sm:text-xl" : "mt-2 text-2xl sm:text-3xl"}`}>{compact ? ldcProjectName(projectName) : title}</Heading>
    {children}
  </section>;
}
