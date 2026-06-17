"use client";

import { useState } from "react";

type DetailExpanderProps = {
  value: string;
  onChange: (value: string) => void;
};

export function DetailExpander({ value, onChange }: DetailExpanderProps) {
  const [open, setOpen] = useState(Boolean(value));

  return (
    <div className="mt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white/60 hover:text-slate-950"
        >
          Add details
        </button>
      ) : (
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Additional details
          </span>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={3}
            placeholder="Add any notes that would help the project team understand this."
            className="w-full rounded-lg border border-white/80 bg-white/72 px-4 py-3 text-base text-slate-950 shadow-inner shadow-white/35 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white/90 focus:ring-4 focus:ring-slate-200/70"
          />
        </label>
      )}
    </div>
  );
}
