import Link from "next/link";
import { CircleHelp, ClipboardCheck, Megaphone, Utensils } from "lucide-react";
import { volunteerPreviewProjectInfo } from "@/lib/volunteerPreview";

type VolunteerProjectInfoProps = {
  showQuestionnaire?: boolean;
  showLunch?: boolean;
};

export function VolunteerProjectInfo({
  showQuestionnaire = true,
  showLunch = true,
}: VolunteerProjectInfoProps) {
  const info = volunteerPreviewProjectInfo;

  return (
    <aside aria-labelledby="project-information-title">
      <h2 id="project-information-title" className="px-1 text-sm font-semibold text-slate-700">
        Other project information
      </h2>
      <div className="mt-3 divide-y divide-slate-200/75 overflow-hidden rounded-2xl border border-white/80 bg-white/58">
        {showQuestionnaire ? <section className="p-5">
          <div className="flex items-center gap-3">
            <ClipboardCheck aria-hidden="true" className="size-5 text-sky-700" strokeWidth={1.8} />
            <h3 className="font-semibold text-slate-950">Questionnaire</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{info.questionnaire.status}.</p>
          <Link
            href={info.questionnaire.href}
            className="mt-2 inline-flex min-h-10 items-center text-sm font-semibold text-sky-700 hover:text-sky-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Open volunteer questionnaire
          </Link>
        </section> : null}

        {showLunch ? <section className="p-5">
          <div className="flex items-center gap-3">
            <Utensils aria-hidden="true" className="size-5 text-sky-700" strokeWidth={1.8} />
            <h3 className="font-semibold text-slate-950">Lunch</h3>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.11em] text-slate-400">{info.lunch.label}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{info.lunch.detail}</p>
        </section> : null}

        <section className="p-5">
          <div className="flex items-center gap-3">
            <Megaphone aria-hidden="true" className="size-5 text-sky-700" strokeWidth={1.8} />
            <h3 className="font-semibold text-slate-950">Project update</h3>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.11em] text-slate-400">{info.update.label}</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{info.update.title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{info.update.detail}</p>
        </section>

        <section className="p-5">
          <div className="flex items-center gap-3">
            <CircleHelp aria-hidden="true" className="size-5 text-sky-700" strokeWidth={1.8} />
            <h3 className="font-semibold text-slate-950">Need help?</h3>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-800">{info.help.contact}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{info.help.detail}</p>
        </section>
      </div>
    </aside>
  );
}
