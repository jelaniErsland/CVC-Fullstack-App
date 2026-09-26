"use client";

import Link from "next/link";
import { MoreHorizontal, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ActionMenuItem = { label: string; href: string; onSelect?: never; confirm?: never } | { label: string; onSelect: () => void; confirm?: string; href?: never };

export function ActionMenu({ label, items, textTrigger = false }: { label: string; items: readonly ActionMenuItem[]; textTrigger?: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<ActionMenuItem | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => list.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("pointerdown", outside); };
  }, [open, confirming]);
  const keys = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const choices = Array.from(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const current = choices.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? choices.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length;
    choices[next]?.focus();
  };
  return <div className="relative inline-flex" ref={root} onKeyDown={keys}>
    <button ref={trigger} type="button" aria-label={textTrigger ? undefined : label} aria-haspopup="menu" aria-expanded={open} onClick={() => {setConfirming(null);setOpen(value => !value);}} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pl-blue)] ${textTrigger ? "border-[var(--pl-blue)] bg-[var(--pl-blue)] text-white" : "min-w-11 border-[var(--pl-border)] bg-white text-[var(--pl-text)]"}`}>
      {textTrigger ? <>{label}<ChevronDown aria-hidden className="size-4" /></> : <MoreHorizontal aria-hidden className="size-5" />}
    </button>
    {open && <div ref={list} role="menu" aria-label={label} className="absolute right-0 top-full z-50 mt-2 min-w-48 max-w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-[var(--pl-border)] bg-white p-1 shadow-xl">
      {confirming ? <div className="p-2"><p className="mb-2 text-sm text-[var(--pl-text)]">{confirming.confirm}</p><button role="menuitem" type="button" onClick={() => {setOpen(false);setConfirming(null);confirming.onSelect?.();}} className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--pl-ink)] hover:bg-[var(--pl-surface-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--pl-blue)]">{confirming.label}</button><button role="menuitem" type="button" onClick={() => setConfirming(null)} className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--pl-text)] hover:bg-[var(--pl-surface-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--pl-blue)]">Cancel</button></div> : items.map(item => item.href ? <Link role="menuitem" key={item.label} href={item.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-[var(--pl-text)] hover:bg-[var(--pl-surface-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--pl-blue)]">{item.label}</Link> : <button role="menuitem" type="button" key={item.label} onClick={() => { if(item.confirm) setConfirming(item); else {setOpen(false);item.onSelect?.();} }} className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--pl-text)] hover:bg-[var(--pl-surface-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--pl-blue)]">{item.label}</button>)}
    </div>}
  </div>;
}
