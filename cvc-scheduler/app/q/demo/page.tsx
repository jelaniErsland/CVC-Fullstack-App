import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { VolunteerQuestionnaire } from "@/components/VolunteerQuestionnaire";

export default function VolunteerQuestionnaireDemoPage() {
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl py-4">
        <header className="mb-5 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-950">
            Project Local
          </Link>
          <Link
            href="/v/demo"
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/58 hover:text-slate-950"
          >
            Sample schedule
          </Link>
        </header>
        <VolunteerQuestionnaire />
      </div>
    </PageShell>
  );
}
