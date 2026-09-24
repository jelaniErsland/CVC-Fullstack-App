"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Download, Upload, X } from "lucide-react";
import { CSV_MAX_BYTES, csvFields, parseVolunteerCsv, privateCsvFields, type CsvField } from "@/lib/volunteers/csv";
import { volunteerCsvAction, type CsvActionState } from "@/lib/volunteers/csv.actions";

const fieldLabel = (field: string) => field.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());
const control = "min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-600";
export function VolunteerCsvTools({ canEdit, filteredIds }: { canEdit: boolean; filteredIds: string[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"import" | "export">("import");
  const [text, setText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<(CsvField | "")[]>([]);
  const [state, setState] = useState<CsvActionState | null>(null);
  const [choices, setChoices] = useState<Record<number, CsvField[]>>({});
  const [requestId, setRequestId] = useState("");
  const [privateExport, setPrivateExport] = useState(false);
  const [busy, start] = useTransition();
  function open(next: typeof mode) { setMode(next); if (next === "export") setPrivateExport(false); dialog.current?.showModal(); }
  function run(command: "preview" | "save") {
    start(async () => {
      const form = new FormData(); form.set("command", command); form.set("csv", text); form.set("mapping", JSON.stringify(mapping));
      form.set("requestId", requestId); form.set("fingerprint", state?.kind === "preview" ? state.fingerprint : "");
      form.set("choices", JSON.stringify(Object.entries(choices).filter(([, fields]) => fields.length).map(([row, fields]) => ({ row: Number(row), fields }))));
      const next = await volunteerCsvAction(form); setState(next);
      if (next.kind === "preview") { setRequestId(crypto.randomUUID()); setChoices(Object.fromEntries(next.rows.filter(r => r.kind === "new").map(r => [r.row, r.fields]))); }
    });
  }
  return <>
    <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3">
      {canEdit && <button className={control} type="button" onClick={() => open("import")}><Upload aria-hidden className="mr-2 inline size-4" />Import CSV</button>}
      <button className={control} type="button" onClick={() => open("export")}><Download aria-hidden className="mr-2 inline size-4" />Export CSV</button>
    </div>
    <dialog ref={dialog} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl backdrop:bg-slate-950/30">
      <header className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">{mode === "import" ? "Import volunteers" : "Export volunteers"}</h2><button aria-label="Close CSV" type="button" className={control} onClick={() => dialog.current?.close()} disabled={busy}><X className="size-4" /></button></header>
      {mode === "export" ? <form action="/admin/volunteers/csv" method="post" className="grid gap-4">
        <label className="grid gap-1 text-sm">Volunteers<select name="scope" className={control}><option value="filtered">Current filtered view ({filteredIds.length})</option><option value="all">All workspace volunteers</option></select></label>
        {filteredIds.map(id => <input key={id} type="hidden" name="profileIds" value={id} />)}
        {canEdit && <label className="flex items-start gap-2 text-sm"><input name="privateFields" value="yes" type="checkbox" checked={privateExport} onChange={e => setPrivateExport(e.target.checked)} />Include private date of birth and emergency fields</label>}
        {privateExport && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><p>This download contains sensitive personal information. Store it securely and share only with authorized project contacts.</p><label className="mt-3 flex gap-2"><input required type="checkbox" name="privateWarningAccepted" value="yes" />I understand and need these private fields.</label></div>}
        <button className={control} type="submit">Download CSV</button>
      </form> : <div className="grid gap-4">
        <p className="text-sm text-slate-600">Add new volunteers or review individual changes to matched profiles. Importing sends no email. Blank cells keep existing information.</p>
        <form action="/admin/volunteers/csv" method="post"><input type="hidden" name="mode" value="template" /><button type="submit" className="text-sm font-semibold text-blue-700 underline">Download template</button></form>
        <label className="grid min-w-0 gap-2 text-sm font-medium">CSV file<input type="file" accept=".csv,text/csv,text/tab-separated-values" className={`${control} w-full`} disabled={busy} onChange={async e => {
          setState(null); setChoices({}); const file = e.target.files?.[0]; if (!file) return;
          try { if (file.size > CSV_MAX_BYTES) throw new Error("Choose a CSV smaller than 512 KB."); const source = await file.text(); const parsed = parseVolunteerCsv(source); setText(source); setHeaders(parsed.headers); setMapping(parsed.mapping); }
          catch (error) { setText(""); setHeaders([]); setState({ kind: "error", message: error instanceof Error ? error.message : "Cannot read this file." }); }
        }} /></label>
        {headers.length > 0 && <details open={!state}><summary className="cursor-pointer text-sm font-semibold">Column mapping</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{headers.map((header, i) => <label key={i} className="grid min-w-0 gap-1 text-xs"><span className="truncate">{header}</span><select className={control} value={mapping[i]} onChange={e => { setMapping(mapping.map((f, n) => n === i ? e.target.value as CsvField | "" : f)); setState(null); }}><option value="">Ignore column</option>{csvFields.map(field => <option key={field} value={field}>{fieldLabel(field)}</option>)}</select></label>)}</div></details>}
        {text && <button className={control} disabled={busy} type="button" onClick={() => run("preview")}>Review import</button>}
        {state?.kind === "error" && <p role="alert" className="text-sm text-red-800">{state.message}</p>}
        {state?.kind === "saved" && <div role="status" className="rounded-xl bg-emerald-50 p-4 text-sm"><p>{state.created} added · {state.updated} updated. No email sent.</p><Link className="mt-2 inline-block font-semibold text-blue-700" href="/admin/volunteers">Return to updated directory</Link></div>}
        {state?.kind === "preview" && <section className="grid gap-3" aria-label="CSV match preview">
          <p className="text-sm font-semibold">{["new", "matched", "invalid", "ambiguous"].map(kind => `${state.rows.filter(r => r.kind === kind).length} ${kind}`).join(" · ")}</p>
          <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-200">{state.rows.map(row => <div key={row.row} className="p-3 text-sm">
            <div className="flex items-start gap-2">{row.kind === "new" && <input aria-label={`Import ${row.name}`} type="checkbox" checked={!!choices[row.row]?.length} onChange={e => setChoices({ ...choices, [row.row]: e.target.checked ? row.fields : [] })} />}<div className="min-w-0"><p className="break-words font-medium">{row.name} <span className="font-normal text-slate-500">· {row.kind}</span></p>{row.reason && <p className="mt-1 text-xs text-amber-900">{row.reason}</p>}</div></div>
            {row.kind === "matched" && <details className="mt-2"><summary className="cursor-pointer text-blue-700">Review fields to update</summary><div className="mt-2 grid gap-2">{row.fields.map(field => <label key={field} className="flex gap-2"><input type="checkbox" checked={choices[row.row]?.includes(field) ?? false} onChange={e => setChoices({ ...choices, [row.row]: e.target.checked ? [...(choices[row.row] ?? []), field] : (choices[row.row] ?? []).filter(f => f !== field) })} /><span className="min-w-0 break-words">{fieldLabel(field)}: {privateCsvFields.includes(field as typeof privateCsvFields[number]) ? "Private value supplied (hidden)" : String(row.values[field] ?? "")}</span></label>)}</div></details>}
          </div>)}</div>
          <button className="rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !Object.values(choices).some(fields => fields.length)} type="button" onClick={() => run("save")}>{busy ? "Saving…" : `Save ${Object.values(choices).filter(fields => fields.length).length} reviewed rows`}</button>
        </section>}
      </div>}
    </dialog>
  </>;
}
