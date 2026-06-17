"use client";

import { useId, useState } from "react";

type HelpPopoverProps = {
  text: string;
};

export function HelpPopover({ text }: HelpPopoverProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label="Help"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) {
            setOpen(false);
          }
        }}
        onClick={() => setOpen((current) => !current)}
        onFocus={() => setOpen(true)}
        className="ml-2 inline-flex size-6 items-center justify-center rounded-full border border-slate-200 bg-white/72 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
      >
        ?
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-8 z-20 w-64 rounded-lg border border-white/80 bg-white/95 p-3 text-sm font-normal leading-6 text-slate-600 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
