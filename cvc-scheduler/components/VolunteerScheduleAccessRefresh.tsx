"use client";

import { useEffect } from "react";

export function VolunteerScheduleAccessRefresh() {
  useEffect(() => {
    window.location.replace("/v/schedule");
  }, []);

  return (
    <div className="rounded-[1.75rem] border border-white/80 bg-white/78 p-7 shadow-[0_28px_90px_rgba(15,23,42,0.11)] backdrop-blur-2xl sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
        Volunteer schedule
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950">
        Opening your secure schedule
      </h1>
      <p className="mt-4 text-base leading-7 text-slate-600">
        Your link is being exchanged for a private browser-session schedule.
      </p>
      <noscript>
        <p className="mt-6 text-sm leading-6 text-slate-500">
          JavaScript is needed to finish opening the clean schedule page. Refresh
          this page, then open your schedule again.
        </p>
      </noscript>
    </div>
  );
}
