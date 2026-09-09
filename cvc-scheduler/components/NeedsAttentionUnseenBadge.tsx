"use client";

import { useEffect, useState } from "react";
import { getNeedsAttentionUnseenCountAction } from "@/app/admin/needs-attention/actions";

export function NeedsAttentionUnseenBadge() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const clear = () => setCount(0);
    window.addEventListener("project-local:needs-attention-seen", clear);
    void getNeedsAttentionUnseenCountAction().then(setCount).catch(clear);
    return () => window.removeEventListener("project-local:needs-attention-seen", clear);
  }, []);
  if (!count) return null;
  return <span aria-label={`${count} new attention item${count === 1 ? "" : "s"}`} className="ml-auto inline-flex min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 py-0.5 text-[10px] font-bold leading-none text-white">{count > 9 ? "9+" : count}</span>;
}
