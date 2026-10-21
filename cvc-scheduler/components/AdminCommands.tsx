"use client";

import { Command, Keyboard, Search, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { MouseEvent, ReactNode } from "react";
import { AdminNavigationLink } from "@/components/AdminRouteHandoff";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFocusContainment } from "@/hooks/useFocusContainment";
import { adminCommands, blocksAdminShortcut, goSequenceTimeout, matchAdminCommands } from "@/lib/adminCommands";

const CommandContext = createContext<(() => void) | null>(null);
const subscribePlatform = () => () => {};
const platformHint = () => /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K";

export function AdminCommandTrigger({ compact = false }: { compact?: boolean }) {
  const open = useContext(CommandContext);
  const hint = useSyncExternalStore(subscribePlatform, platformHint, () => "Ctrl K");
  return <button type="button" aria-label="Open command palette" aria-haspopup="dialog" onClick={open ?? undefined}
    className={`${compact ? "ml-auto size-11 shrink-0 justify-center" : "mt-4 min-h-10 w-full gap-2 px-2 text-left"} inline-flex items-center rounded-lg border border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] text-xs text-[var(--pl-muted)] hover:text-[var(--pl-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}>
    <Search aria-hidden="true" className="size-4 shrink-0" />
    {!compact && <><span className="min-w-0 flex-1 truncate">Jump to…</span><kbd className="whitespace-nowrap text-[10px]">{hint}</kbd></>}
  </button>;
}

function visible(element: HTMLElement) { return !element.closest('[hidden], [inert]') && element.getClientRects().length > 0; }
function localTarget(kind: "search" | "filters" | "today") {
  const targets = document.querySelectorAll<HTMLElement>(`#main-content [data-admin-shortcut~="${kind}"]`);
  for (const target of targets) {
    if (target.closest('[hidden], [inert]') || (target instanceof HTMLButtonElement && target.disabled)) continue;
    // Attention's existing mobile filter disclosure contains its primary search.
    const disclosure = target.closest("details");
    if (disclosure && !disclosure.open) disclosure.open = true;
    if (!visible(target)) continue;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) target.focus();
    else {
      target.focus();
      target.click();
      if (kind === "search") requestAnimationFrame(() => requestAnimationFrame(() => {
        const search = [...document.querySelectorAll<HTMLInputElement>('[data-admin-opened-search]')].find(visible);
        if (search && (document.activeElement === target || search.closest('[role="dialog"]')?.contains(document.activeElement))) search.focus();
      }));
    }
    return true;
  }
  return false;
}

export function AdminCommands({ children, destinations, capabilities, calendarHref }: { children: ReactNode; destinations: readonly string[]; capabilities: readonly string[]; calendarHref: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());
  const returnFocus = useRef<HTMLElement | null>(null);
  const goUntil = useRef(0);
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState(false);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState(0);
  const hint = useSyncExternalStore(subscribePlatform, platformHint, () => "Ctrl K");
  const commands = useMemo(() => adminCommands(destinations, capabilities, calendarHref), [destinations, capabilities, calendarHref]);
  const matches = matchAdminCommands(commands, query);
  const showHelp = matchAdminCommands([{ id: "help", label: "Keyboard shortcuts", detail: "", href: "", destination: "", keywords: "keys help reference" }], query).length > 0;
  const count = matches.length + Number(showHelp);
  const selected = Math.min(selection, Math.max(0, count - 1));
  useBodyScrollLock(open);
  useFocusContainment(open, dialogRef);

  const close = useCallback(() => {
    dialogRef.current?.close();
    setOpen(false);
    goUntil.current = 0;
    if (returnFocus.current?.isConnected && visible(returnFocus.current)) returnFocus.current.focus({ preventScroll: true });
  }, []);
  const reveal = useCallback(() => {
    // Don't stack over an editor, inspector, mobile More, or another modal.
    if ([...document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"], [aria-modal="true"]')].some(visible)) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    goUntil.current = 0;
    setQuery(""); setSelection(0); setReference(false); setOpen(true);
    dialogRef.current?.showModal();
    inputRef.current?.focus();
  }, []);

  const activate = (id: string, event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // Reuse the mounted Calendar's create control, including repeated opens.
    // Cross-route entry remains the existing authorized create=1 deep link.
    const create = id === "create" && location.pathname === "/admin/calendar"
      ? [...document.querySelectorAll<HTMLButtonElement>('[data-admin-command-open="create"]')].find(visible) : null;
    if (create && !create.disabled) { event.preventDefault(); close(); create.click(); }
    else close();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) { goUntil.current = 0; return; }
      if (event.repeat) return;
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        if (dialogRef.current?.open) { event.preventDefault(); close(); }
        else { reveal(); if (dialogRef.current?.open) event.preventDefault(); }
        return;
      }
      if (event.key === "Escape") { goUntil.current = 0; return; }
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || blocksAdminShortcut(event.target) || [...document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"], [aria-modal="true"]')].some(visible)) { goUntil.current = 0; return; }
      const key = event.key.toLowerCase();
      if (goUntil.current > Date.now()) {
        goUntil.current = 0;
        const destination = commands.find(command => command.key?.toLowerCase() === key);
        if (destination) { event.preventDefault(); linkRefs.current.get(destination.id)?.click(); }
        return;
      }
      if (key === "g") { goUntil.current = Date.now() + goSequenceTimeout; event.preventDefault(); }
      else if (key === "/") { event.preventDefault(); if (!localTarget("search")) reveal(); }
      else if (key === "f") { if (localTarget("filters")) event.preventDefault(); }
      else if (key === "t" && location.pathname === "/admin/calendar") { if (localTarget("today")) event.preventDefault(); }
    };
    const resetSequence = () => { goUntil.current = 0; };
    document.addEventListener("keydown", onKey);
    window.addEventListener("blur", resetSequence);
    document.addEventListener("pointerdown", resetSequence);
    return () => { document.removeEventListener("keydown", onKey); window.removeEventListener("blur", resetSequence); document.removeEventListener("pointerdown", resetSequence); };
  }, [commands, close, reveal]);

  useEffect(() => {
    if (open) dialogRef.current?.querySelector(`#admin-command-${selected}`)?.scrollIntoView({ block: "nearest" });
  }, [selected, open]);

  useEffect(() => {
    if (reference) dialogRef.current?.querySelector<HTMLButtonElement>('[data-command-back]')?.focus();
  }, [reference]);

  return <CommandContext.Provider value={reveal}>
    {children}
    {/* Keyboard commands activate the same native Next links as the sidebar.
        No router, history repair, operational action, or speculative prefetch. */}
    <div hidden aria-hidden="true">{commands.map(command => <AdminNavigationLink key={command.id} href={command.href} prefetch={false} ref={node => { if (node) linkRefs.current.set(command.id, node); else linkRefs.current.delete(command.id); }} tabIndex={-1}>{command.label}</AdminNavigationLink>)}</div>
    <dialog ref={dialogRef} aria-label={reference ? "Keyboard shortcuts" : "Command palette"} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}
      className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-1.5rem)] max-w-lg overflow-hidden rounded-2xl border border-[var(--pl-border)] bg-white p-0 text-[var(--pl-ink)] shadow-2xl backdrop:bg-slate-950/30 max-sm:mb-3 max-sm:mt-auto">
      <div className="flex items-center gap-3 border-b border-[var(--pl-border)] px-4 py-3">
        <button type="button" aria-label="Close command palette" onClick={close} className="order-3 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--pl-muted)] hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X aria-hidden className="size-4" /></button>
        {reference ? <Keyboard aria-hidden className="size-5 shrink-0 text-[var(--pl-muted)]" /> : <Command aria-hidden className="size-5 shrink-0 text-[var(--pl-muted)]" />}
        {reference ? <h2 className="flex-1 text-sm font-semibold">Keyboard shortcuts</h2> : <input ref={inputRef} role="combobox" aria-label="Search commands" aria-controls="admin-command-results" aria-expanded="true" aria-autocomplete="list" aria-activedescendant={count ? `admin-command-${selected}` : undefined} autoComplete="off" placeholder="Search or jump to…" value={query}
          className="min-h-11 min-w-0 flex-1 rounded-md bg-transparent px-1 text-base outline-none" onChange={event => { setQuery(event.target.value); setSelection(0); }} onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setSelection((selected + (event.key === "ArrowDown" ? 1 : -1) + count) % Math.max(1, count)); }
            if (event.key === "Enter") { event.preventDefault(); dialogRef.current?.querySelector<HTMLElement>(`#admin-command-${selected}`)?.click(); }
          }} />}
      </div>
      {reference ? <div className="max-h-[60dvh] overflow-y-auto p-4"><dl className="space-y-3 text-sm"><div className="flex justify-between gap-3"><dt>Command palette</dt><dd><kbd>{hint}</kbd></dd></div>{commands.filter(command => command.key).map(command => <div className="flex justify-between gap-3" key={command.id}><dt>{command.label}</dt><dd className="whitespace-nowrap"><kbd>G</kbd> then <kbd>{command.key}</kbd></dd></div>)}{[["Search (or commands)", "/"], ["Existing filters", "F"], ["Calendar Today", "T"]].map(([label, key]) => <div className="flex justify-between gap-3" key={key}><dt>{label}</dt><dd><kbd>{key}</kbd></dd></div>)}</dl><p className="mt-5 text-xs leading-5 text-[var(--pl-muted)]">Go-to keys expire after 1.2 seconds. Shortcuts pause while typing or using a dialog. Escape closes or cancels; commands never save or send.</p><button data-command-back type="button" onClick={() => { setReference(false); requestAnimationFrame(() => inputRef.current?.focus()); }} className="mt-3 min-h-11 rounded-lg px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-blue-500">Back to commands</button></div> : <>
        <div id="admin-command-results" tabIndex={-1} role="listbox" aria-label="Commands" className="max-h-[min(60dvh,28rem)] overflow-y-auto overscroll-contain p-2">
          {matches.map((command, index) => <AdminNavigationLink prefetch={false} id={`admin-command-${index}`} role="option" aria-selected={selected === index} tabIndex={-1} href={command.href} key={command.id} onClick={event => activate(command.id, event)} onPointerMove={() => setSelection(index)}
            className={`flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 ${selected === index ? "bg-[var(--pl-surface-subtle)] ring-1 ring-inset ring-slate-200" : "hover:bg-slate-50"}`}>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{command.label}</span><span className="mt-0.5 block text-xs text-[var(--pl-muted)]">{command.detail}</span></span>{command.key && <kbd aria-hidden className="whitespace-nowrap text-[10px] text-[var(--pl-muted)]">G {command.key}</kbd>}
          </AdminNavigationLink>)}
          {showHelp && <button id={`admin-command-${matches.length}`} role="option" aria-selected={selected === matches.length} tabIndex={-1} type="button" onPointerMove={() => setSelection(matches.length)} onClick={() => setReference(true)} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold ${selected === matches.length ? "bg-[var(--pl-surface-subtle)] ring-1 ring-inset ring-slate-200" : "hover:bg-slate-50"}`}><Keyboard aria-hidden className="size-4 text-[var(--pl-muted)]" />Keyboard shortcuts</button>}
          {!count && <p role="status" className="px-3 py-8 text-center text-sm text-[var(--pl-muted)]">No commands found. Try Calendar, volunteers, or help.</p>}
        </div><p className="border-t border-[var(--pl-border)] px-4 py-2.5 text-xs text-[var(--pl-muted)]">↑ ↓ to choose · Enter to open · Esc to close</p>
      </>}
    </dialog>
  </CommandContext.Provider>;
}
