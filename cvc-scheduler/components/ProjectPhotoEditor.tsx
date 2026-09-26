"use client";
import { Camera, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectHero } from "./ProjectHero";
import { Button } from "./Button";
import { ActionMenu } from "./ActionMenu";
import type { ProjectPhoto } from "@/lib/projectPhoto/photo";
const control = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-blue-600";
export function ProjectPhotoEditor({ initialPhoto, projectName, canEdit, compact = false }: { compact?: boolean; initialPhoto: ProjectPhoto; projectName: string; canEdit: boolean }) {
  const [photo, setPhoto] = useState(initialPhoto), [crop, setCrop] = useState(initialPhoto);
  const [file, setFile] = useState<File | null>(null), [url, setUrl] = useState<string | undefined>();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null); const router = useRouter();
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  function chooseFile(next: File | null) { setFile(next); setUrl(next ? URL.createObjectURL(next) : undefined); }
  async function save(command: "save" | "remove") {
    setBusy(true); setMessage("");
    try {
      const form = new FormData(); if (file && command === "save") form.set("photo", file);
      form.set("command", command); form.set("version", String(photo.version));
      for (const [key, value] of Object.entries({ desktopX: crop.desktop_x, desktopY: crop.desktop_y, mobileX: crop.mobile_x, mobileY: crop.mobile_y })) form.set(key, String(value));
      const response = await fetch("/admin/project-photo", { method: "POST", body: form }); const result = await response.json();
      if (!response.ok || !result.photo) { setMessage(result.error ?? "Save could not be confirmed. Refresh before retrying."); return; }
      setPhoto(result.photo); setCrop(result.photo); chooseFile(null); dialog.current?.close(); setEditing(false); router.refresh();
    } catch { setMessage("Save could not be confirmed. Refresh the Overview before retrying."); }
    finally { setBusy(false); }
  }
  const openEditor = () => { setCrop(photo); chooseFile(null); setMessage(""); setEditing(true); dialog.current?.showModal(); };
  return <>
    {compact && !photo.asset_id ? canEdit && <Button type="button" variant="ghost" onClick={openEditor}><Camera className="size-[18px]" aria-hidden />Add project photo</Button> :
      <div className="relative"><ProjectHero compact={compact} photo={photo} projectName={projectName} title={compact ? "Project photo" : "Overview"}>{canEdit && !compact && <button type="button" className="relative mt-3 flex min-h-11 w-fit items-center gap-2 rounded-lg bg-slate-950/65 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-white" onClick={openEditor}><Camera className="size-4" aria-hidden />Change photo</button>}</ProjectHero>{canEdit && compact && <div className="absolute right-3 top-3 z-10"><ActionMenu label="Project photo actions" items={[{ label: "Change project photo", onSelect: openEditor }]} /></div>}</div>}
    <dialog ref={dialog} className="m-auto max-h-[94dvh] w-[calc(100%-1.5rem)] max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-950/40" onCancel={e => { if (busy) e.preventDefault(); else { setEditing(false); chooseFile(null); } }}>
      <header className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Project photo</h2><button type="button" aria-label="Close photo editor" disabled={busy} className={control} onClick={() => { chooseFile(null); dialog.current?.close(); setEditing(false); }}><X className="size-4" /></button></header>
      <p className="mt-2 text-sm text-slate-600">The same photo appears on the admin Overview and volunteer home.</p>
      <label className="mt-4 grid min-w-0 gap-2 text-sm font-medium">Choose photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className={`${control} min-w-0 w-full`} onChange={e => { const next = e.target.files?.[0]; if (!next) return; if (next.size > 6 * 1024 * 1024) { setMessage("Choose an image under 6 MB."); return; } setMessage(""); chooseFile(next); }} /></label>
      <div className="mt-5 grid items-start gap-5 md:grid-cols-[1.6fr_1fr]">{editing && (["desktop", "mobile"] as const).map(size => <section key={size} className="min-w-0"><h3 className="mb-2 text-sm font-semibold">{size === "desktop" ? "Desktop preview" : "Mobile preview"}</h3><ProjectHero photo={crop} previewUrl={url} previewSize={size} projectName={projectName} title="Welcome, Alex." /><div className="mt-3 grid gap-2">{(["x", "y"] as const).map(axis => { const key = `${size}_${axis}` as "desktop_x" | "desktop_y" | "mobile_x" | "mobile_y"; return <label key={axis} className="grid gap-1 text-xs text-slate-600">{size} {axis === "x" ? "horizontal" : "vertical"} focal point<input aria-label={`${size} ${axis === "x" ? "horizontal" : "vertical"} focal point`} type="range" min={0} max={100} value={crop[key]} onChange={e => setCrop({ ...crop, [key]: Number(e.target.value) })} className="w-full accent-blue-600" /></label>; })}</div></section>)}</div>
      {message && <p role="alert" className="mt-3 text-sm text-red-800">{message}</p>}
      <div className="mt-5 flex flex-wrap gap-2"><button type="button" disabled={busy || (!file && !photo.asset_id)} onClick={() => save("save")} className={`${control} bg-blue-700 text-white disabled:opacity-50`}>{busy ? "Saving…" : "Save shared photo"}</button><button type="button" disabled={busy} className={control} onClick={() => { chooseFile(null); dialog.current?.close(); setEditing(false); }}>Cancel</button>{photo.asset_id && <button type="button" disabled={busy} onClick={() => save("remove")} className={`${control} text-red-800`}>Remove photo</button>}</div>
    </dialog>
  </>;
}
