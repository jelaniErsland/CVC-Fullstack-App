import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { PublicQuestionnaireForm } from "@/components/PublicQuestionnaireForm";
import { getProjectById, projects } from "@/lib/mockData";

type QuestionnairePageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export function generateStaticParams() {
  return projects.map((project) => ({
    projectId: project.id,
  }));
}

function UnavailableQuestionnaireMessage({ projectName }: { projectName?: string }) {
  return (
    <PageShell>
      <div className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-3xl items-center">
        <GlassCard className="w-full p-6 text-center sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Questionnaire unavailable
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            This questionnaire is not open right now.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600">
            {projectName
              ? `${projectName} is not accepting public questionnaire responses in this prototype.`
              : "We could not find an open project workspace for this questionnaire link."}
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
            If you were given this link by a project contact, please check with them for the
            current volunteer intake instructions.
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full border border-white/80 bg-white/64 px-5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-white/86 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            Back to CVC Scheduler
          </Link>
        </GlassCard>
      </div>
    </PageShell>
  );
}

export default async function QuestionnairePage({ params }: QuestionnairePageProps) {
  const { projectId } = await params;
  const project = getProjectById(projectId);

  if (!project || project.status !== "active" || !project.enabledModules.includes("volunteers")) {
    return <UnavailableQuestionnaireMessage projectName={project?.name} />;
  }

  return (
    <PageShell>
      <PublicQuestionnaireForm project={project} />
    </PageShell>
  );
}
