import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { QuestionnaireReviewQueue } from "@/components/QuestionnaireReviewQueue";
import { getQuestionnaireReviewItems } from "@/lib/mockData";

export default function AdminQuestionnairesPage() {
  const reviewItems = getQuestionnaireReviewItems();

  return (
    <PageShell>
      <div className="mx-auto grid min-h-[calc(100vh-40px)] w-full max-w-7xl gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="lg:py-4">
          <GlassCard className="p-4 lg:sticky lg:top-6">
            <Link href="/" className="block text-lg font-semibold tracking-tight text-slate-950">
              CVC Scheduler
            </Link>
            <AdminNav active="questionnaires" />
          </GlassCard>
        </aside>

        <main className="py-4">
          <header className="rounded-2xl border border-white/60 bg-white/28 px-5 py-5 backdrop-blur-xl sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Volunteer Intake
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Questionnaire Review
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Review incoming volunteer questionnaires before they become ready for scheduling.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              This mock queue shows the general admin view for assigned project workspaces.
              Later, it can be scoped by project role without changing the volunteer intake flow.
            </p>
          </header>

          <section className="mt-6">
            <QuestionnaireReviewQueue items={reviewItems} />
          </section>
        </main>
      </div>
    </PageShell>
  );
}
