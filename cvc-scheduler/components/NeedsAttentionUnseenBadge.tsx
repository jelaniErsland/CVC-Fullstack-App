"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getNeedsAttentionUnseenCountAction } from "@/app/admin/needs-attention/actions";
import { withReadTimeout } from "@/lib/readTimeout";

const BadgeContext = createContext<number | null>(0);

// One read per mounted shell/navigation, shared by desktop and mobile. No
// module cache: private counts never survive the shell or cross accounts.
export function NeedsAttentionBadgeProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const [result, setResult] = useState<{ pathname: string; count: number | null } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const clear = () => { active = false; setResult({ pathname, count: 0 }); };
    window.addEventListener("project-local:needs-attention-seen", clear);
    void withReadTimeout(getNeedsAttentionUnseenCountAction()).then(count => {
      if (active) setResult({ pathname, count });
    }).catch(() => { if (active) setResult({ pathname, count: null }); });
    return () => { active = false; window.removeEventListener("project-local:needs-attention-seen", clear); };
  }, [enabled, pathname]);
  const count = enabled && result?.pathname === pathname ? result.count : 0;
  return <BadgeContext.Provider value={count}>{children}</BadgeContext.Provider>;
}

export function NeedsAttentionUnseenBadge() {
  const count = useContext(BadgeContext);
  if (count === null) return <span className="ml-auto text-xs" title="Attention count unavailable. Open Needs Attention to retry." aria-label="Attention count unavailable. Open Needs Attention to retry.">!</span>;
  if (!count) return null;
  return <span aria-label={`${count} new attention item${count === 1 ? "" : "s"}`} className="ml-auto inline-flex min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 py-0.5 text-[10px] font-bold leading-none text-white">{count > 9 ? "9+" : count}</span>;
}
