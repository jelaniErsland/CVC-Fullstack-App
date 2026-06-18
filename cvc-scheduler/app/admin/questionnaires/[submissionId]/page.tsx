import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/Button";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import {
  getLinkedVolunteerForSubmission,
  getProjectById,
  getQuestionnaireReviewItemById,
  getQuestionnaireSectionProgress,
  getQuestionnaireStatusLabel,
  getQuestionnaireSubmissionById,
  getQuestionnaireWorkflowStateFromSubmission,
  getVolunteerProfilePreviewFromSubmission,
  questionnaireSectionLabels,
  questionnaireSubmissions,
} from "@/lib/mockData";
import type {
  OtherWaysToHelpResponses,
  QuestionnaireWorkflowAction,
  QuestionnaireSectionKey,
  VolunteerQuestionnaireSubmission,
} from "@/lib/mockData";

type AdminQuestionnaireDetailPageProps = {
  params: Promise<{
    submissionId: string;
  }>;
};

const sourceLabels = {
  online: "Online",
  paper: "Paper",
  manualEntry: "Manual entry",
};

const otherHelpLabels: Array<[keyof OtherWaysToHelpResponses, string]> = [
  ["housing", "Housing"],
  ["transportation", "Transportation"],
  ["laundryDryCleaning", "Laundry / dry cleaning"],
  ["housekeeping", "Housekeeping"],
  ["hairCare", "Hair care"],
  ["medicalSupport", "Medical support"],
  ["foodService", "Food service"],
];

const readinessStyles = {
  "Ready for volunteer profile": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Needs follow-up first": "border-amber-200 bg-amber-50 text-amber-700",
  "Missing required info": "border-slate-200 bg-slate-50 text-slate-600",
  "Already linked to volunteer profile": "border-sky-200 bg-sky-50 text-sky-700",
};

const workflowStyles = {
  "New submission": "border-sky-200 bg-sky-50 text-sky-700",
  "Needs review": "border-amber-200 bg-amber-50 text-amber-700",
  "Needs follow-up": "border-amber-200 bg-amber-50 text-amber-700",
  "Missing required info": "border-slate-200 bg-slate-50 text-slate-600",
  "Ready for volunteer profile": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Already linked / reviewed": "border-sky-200 bg-sky-50 text-sky-700",
};

function yesNo(value: boolean | undefined) {
  return value ? "Yes" : "No";
}

function formatDate(value?: string) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function valueOrMissing(value: string | undefined, missing = "Not provided") {
  return value?.trim() ? value : missing;
}

function AnswerRow({
  label,
  value,
  missing = false,
}: {
  label: string;
  value: string;
  missing?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-lg border px-4 py-3",
        missing
          ? "border-amber-200/70 bg-amber-50/58"
          : "border-white/70 bg-white/50",
      ].join(" ")}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{value}</p>
    </div>
  );
}

function ReadinessBadge({ status }: { status: keyof typeof readinessStyles }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${readinessStyles[status]}`}
    >
      {status}
    </span>
  );
}

function WorkflowBadge({ status }: { status: keyof typeof workflowStyles }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${workflowStyles[status]}`}
    >
      {status}
    </span>
  );
}

function WorkflowActionButton({ action }: { action: QuestionnaireWorkflowAction }) {
  if (action.enabled && action.href) {
    return (
      <div>
        <Button href={action.href} variant="secondary" className="w-full">
          {action.label}
        </Button>
        <p className="mt-2 text-xs leading-5 text-slate-500">{action.description}</p>
      </div>
    );
  }

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        disabled
        className="w-full cursor-not-allowed opacity-60"
      >
        {action.label}
      </Button>
      <p className="mt-2 text-xs leading-5 text-slate-500">{action.description}</p>
    </div>
  );
}

function DetailSection({
  title,
  sectionKey,
  completedSections,
  flaggedSections,
  children,
}: {
  title: string;
  sectionKey?: QuestionnaireSectionKey;
  completedSections?: Record<QuestionnaireSectionKey, boolean>;
  flaggedSections?: QuestionnaireSectionKey[];
  children: React.ReactNode;
}) {
  const isComplete = sectionKey ? completedSections?.[sectionKey] : undefined;
  const isFlagged = sectionKey ? flaggedSections?.includes(sectionKey) : false;

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
        {sectionKey ? (
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/80 bg-white/62 px-3 py-1 text-xs font-semibold text-slate-600">
              {isComplete ? "Complete" : "Needs detail"}
            </span>
            {isFlagged ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                Review note
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-5 grid gap-3 text-sm leading-6 text-slate-600 sm:grid-cols-2">
        {children}
      </div>
    </GlassCard>
  );
}

function OtherHelpSummary({ submission }: { submission: VolunteerQuestionnaireSubmission }) {
  const selected = otherHelpLabels
    .filter(([key]) => Boolean(submission.otherWaysToHelp[key]))
    .map(([, label]) => label);

  return (
    <>
      <AnswerRow
        label="Selected ways to help"
        value={selected.join(", ") || "No other categories selected"}
        missing={selected.length === 0}
      />
      <AnswerRow
        label="Medical support details"
        value={valueOrMissing(submission.otherWaysToHelp.medicalSupportDetails)}
        missing={!submission.otherWaysToHelp.medicalSupportDetails}
      />
      <AnswerRow
        label="Other"
        value={valueOrMissing(submission.otherWaysToHelp.other)}
        missing={!submission.otherWaysToHelp.other}
      />
      <AnswerRow
        label="Additional details"
        value={valueOrMissing(submission.otherWaysToHelp.details)}
        missing={!submission.otherWaysToHelp.details}
      />
    </>
  );
}

function NotFoundState() {
  return (
    <AdminShell active="questionnaires">
      <GlassCard className="p-6 text-center sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          Questionnaire Review
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Questionnaire not found
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
          This mock submission may have been removed or the link may be incomplete.
          Return to the review queue to choose another questionnaire.
        </p>
        <Button href="/admin/questionnaires" variant="secondary" className="mt-6">
          Back to questionnaires
        </Button>
      </GlassCard>
    </AdminShell>
  );
}

export function generateStaticParams() {
  return questionnaireSubmissions.map((submission) => ({
    submissionId: submission.id,
  }));
}

export default async function AdminQuestionnaireDetailPage({
  params,
}: AdminQuestionnaireDetailPageProps) {
  const { submissionId } = await params;
  const submission = getQuestionnaireSubmissionById(submissionId);
  const reviewItem = getQuestionnaireReviewItemById(submissionId);

  if (!submission || !reviewItem) {
    return <NotFoundState />;
  }

  const project = getProjectById(submission.projectId);
  const linkedVolunteer = getLinkedVolunteerForSubmission(submission);
  const sectionProgress = getQuestionnaireSectionProgress(submission);
  const flaggedSections = submission.review.flaggedSectionKeys;
  const statusLabel = getQuestionnaireStatusLabel(submission.status);
  const volunteerProfilePreview = getVolunteerProfilePreviewFromSubmission(submission);
  const workflowState = getQuestionnaireWorkflowStateFromSubmission(submission);

  return (
    <AdminShell active="questionnaires">
          <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <Link
                href="/admin/questionnaires"
                className="text-sm font-medium text-slate-500 hover:text-slate-950"
              >
                Questionnaire Review
              </Link>
              <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                {project?.name ?? "Project workspace"}
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  {submission.aboutYou.name}
                </h1>
                <StatusPill status={reviewItem.status} />
              </div>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Review the submitted questionnaire answers before the volunteer is ready
                for scheduling.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[18rem] xl:grid-cols-1">
              {workflowState.actions.map((action) => (
                <WorkflowActionButton key={action.label} action={action} />
              ))}
            </div>
          </header>

          <section className="mt-8 grid gap-4 lg:grid-cols-[1fr_320px]">
            <GlassCard className="p-5 sm:p-6">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Review Summary
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <AnswerRow label="Congregation" value={submission.aboutYou.congregation} />
                <AnswerRow label="Submitted" value={reviewItem.submittedDate} />
                <AnswerRow label="Status" value={statusLabel} />
                <AnswerRow label="Source" value={sourceLabels[submission.sourceType]} />
                <AnswerRow label="Updated" value={reviewItem.updatedDate} />
                <AnswerRow
                  label="Sections complete"
                  value={`${sectionProgress.completed} of ${sectionProgress.total}`}
                />
              </div>
            </GlassCard>

            <GlassCard className="p-5 sm:p-6">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Linked Volunteer
              </h2>
              {linkedVolunteer ? (
                <div className="mt-5 grid gap-3 text-sm leading-6 text-slate-600">
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-white/50 px-4 py-3">
                    <div>
                      <p className="font-semibold text-slate-950">{linkedVolunteer.name}</p>
                      <p className="mt-1 text-slate-500">
                        {linkedVolunteer.congregation} Congregation
                      </p>
                    </div>
                    <StatusPill status={linkedVolunteer.status} />
                  </div>
                  <Button href={`/admin/volunteers/${linkedVolunteer.id}`} variant="secondary">
                    Open volunteer profile
                  </Button>
                </div>
              ) : (
                <p className="mt-5 rounded-lg border border-white/70 bg-white/50 px-4 py-3 text-sm leading-6 text-slate-600">
                  This questionnaire is not linked to a volunteer profile yet.
                </p>
              )}
            </GlassCard>
          </section>

          <section className="mt-4">
            <GlassCard className="p-5 sm:p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Workflow Guidance
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                    {workflowState.title}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    {workflowState.guidance}
                  </p>
                </div>
                <WorkflowBadge status={workflowState.status} />
              </div>
              <div className="mt-4 rounded-lg border border-white/70 bg-white/46 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Suggested next step
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  {workflowState.nextStepSummary}
                </p>
              </div>
            </GlassCard>
          </section>

          {reviewItem.flagLabels.length > 0 ? (
            <section className="mt-4">
              <GlassCard className="p-5 sm:p-6">
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  Review Flags
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {reviewItem.flagLabels.map((flag) => (
                    <span
                      key={flag}
                      className="rounded-full border border-white/80 bg-white/62 px-3 py-1.5 text-sm font-semibold text-slate-600"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </GlassCard>
            </section>
          ) : null}

          <section className="mt-4">
            <GlassCard className="p-5 sm:p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Conversion Preview
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                    Volunteer Profile Preview
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    This shows the volunteer record that could be created from the questionnaire.
                    It is a mock preview only and does not create or update anything.
                  </p>
                </div>
                <ReadinessBadge status={volunteerProfilePreview.readinessStatus} />
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                <AnswerRow label="Name" value={volunteerProfilePreview.name} />
                <AnswerRow label="Congregation" value={volunteerProfilePreview.congregation} />
                <AnswerRow
                  label="Suggested status"
                  value={volunteerProfilePreview.suggestedVolunteerStatus}
                />
                <AnswerRow
                  label="Email"
                  value={valueOrMissing(volunteerProfilePreview.email)}
                  missing={!volunteerProfilePreview.email}
                />
                <AnswerRow
                  label="Phone"
                  value={valueOrMissing(volunteerProfilePreview.phone)}
                  missing={!volunteerProfilePreview.phone}
                />
                <AnswerRow
                  label="Emergency contact"
                  value={
                    volunteerProfilePreview.emergencyContactComplete
                      ? "Complete"
                      : "Needs detail"
                  }
                  missing={!volunteerProfilePreview.emergencyContactComplete}
                />
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <AnswerRow
                  label="Availability"
                  value={volunteerProfilePreview.availabilitySummary}
                />
                <AnswerRow
                  label="Skills / experience"
                  value={volunteerProfilePreview.skillsExperienceSummary}
                />
                <AnswerRow
                  label="Other ways to help"
                  value={volunteerProfilePreview.otherWaysToHelpSummary}
                />
              </div>

              <div className="mt-4 rounded-lg border border-white/70 bg-white/46 px-4 py-4">
                <p className="text-sm font-semibold text-slate-950">
                  Blockers before scheduling
                </p>
                <div className="mt-3 grid gap-2">
                  {volunteerProfilePreview.blockersBeforeScheduling.map((blocker) => (
                    <p
                      key={blocker}
                      className="rounded-lg bg-white/58 px-3 py-2 text-sm leading-6 text-slate-600"
                    >
                      {blocker}
                    </p>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[220px_220px_1fr]">
                {linkedVolunteer ? (
                  <Button href={`/admin/volunteers/${linkedVolunteer.id}`} variant="secondary">
                    Open linked profile
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled
                    className="cursor-not-allowed opacity-60"
                  >
                    Create profile (coming next)
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  disabled
                  className="cursor-not-allowed opacity-60"
                >
                  Mark needs follow-up (coming next)
                </Button>
              </div>
            </GlassCard>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <DetailSection
              title={questionnaireSectionLabels.aboutYou}
              sectionKey="aboutYou"
              completedSections={sectionProgress.sections}
              flaggedSections={flaggedSections}
            >
              <AnswerRow label="Name" value={submission.aboutYou.name} />
              <AnswerRow label="Congregation" value={submission.aboutYou.congregation} />
              <AnswerRow
                label="Email"
                value={valueOrMissing(submission.aboutYou.email)}
                missing={!submission.aboutYou.email}
              />
              <AnswerRow
                label="Phone"
                value={valueOrMissing(submission.aboutYou.phone)}
                missing={!submission.aboutYou.phone}
              />
              <AnswerRow
                label="Date of birth"
                value={valueOrMissing(submission.aboutYou.dateOfBirth)}
                missing={!submission.aboutYou.dateOfBirth}
              />
              <AnswerRow
                label="Preferred contact"
                value={valueOrMissing(submission.aboutYou.preferredContactMethod)}
                missing={!submission.aboutYou.preferredContactMethod}
              />
            </DetailSection>

            <DetailSection
              title={questionnaireSectionLabels.availability}
              sectionKey="availability"
              completedSections={sectionProgress.sections}
              flaggedSections={flaggedSections}
            >
              <AnswerRow
                label="Available days"
                value={submission.availability.weekdays.join(", ") || "No days selected"}
                missing={submission.availability.weekdays.length === 0}
              />
              <AnswerRow
                label="Preferred times"
                value={submission.availability.preferredTimes.join(", ") || "No times selected"}
                missing={submission.availability.preferredTimes.length === 0}
              />
              <AnswerRow
                label="Two or more days"
                value={yesNo(submission.availability.canServeMultipleDays)}
              />
              <AnswerRow
                label="Multiple-day details"
                value={valueOrMissing(submission.availability.canServeMultipleDaysDetails)}
                missing={!submission.availability.canServeMultipleDaysDetails}
              />
              <AnswerRow
                label="After-hours security"
                value={yesNo(submission.availability.availableForAfterHoursSecurity)}
              />
              <AnswerRow
                label="Security details"
                value={valueOrMissing(submission.availability.afterHoursSecurityDetails)}
                missing={!submission.availability.afterHoursSecurityDetails}
              />
              <AnswerRow
                label="Limitations"
                value={valueOrMissing(submission.availability.limitations, "No limits noted")}
                missing={!submission.availability.limitations}
              />
            </DetailSection>

            <DetailSection
              title={questionnaireSectionLabels.skillsExperience}
              sectionKey="skillsExperience"
              completedSections={sectionProgress.sections}
              flaggedSections={flaggedSections}
            >
              <AnswerRow
                label="Construction skills"
                value={submission.skillsExperience.construction.join(", ") || "None listed"}
                missing={submission.skillsExperience.construction.length === 0}
              />
              <AnswerRow
                label="Maintenance task cards"
                value={yesNo(submission.skillsExperience.maintenanceTaskCards)}
              />
              <AnswerRow
                label="Task cards"
                value={valueOrMissing(submission.skillsExperience.taskCards, "No task cards listed")}
                missing={!submission.skillsExperience.taskCards}
              />
              <AnswerRow
                label="Task card details"
                value={valueOrMissing(submission.skillsExperience.taskCardAdditionalDetails)}
                missing={!submission.skillsExperience.taskCardAdditionalDetails}
              />
              <AnswerRow
                label="Comfortable with physical work"
                value={yesNo(submission.skillsExperience.comfortableWithPhysicalWork)}
              />
              <AnswerRow
                label="Physical work details"
                value={valueOrMissing(submission.skillsExperience.physicalWorkDetails)}
                missing={!submission.skillsExperience.physicalWorkDetails}
              />
              <AnswerRow
                label="Skill notes"
                value={valueOrMissing(submission.skillsExperience.notes)}
                missing={!submission.skillsExperience.notes}
              />
            </DetailSection>

            <DetailSection
              title={questionnaireSectionLabels.emergencyContact}
              sectionKey="emergencyContact"
              completedSections={sectionProgress.sections}
              flaggedSections={flaggedSections}
            >
              <AnswerRow
                label="Name"
                value={valueOrMissing(submission.emergencyContact?.name)}
                missing={!submission.emergencyContact?.name}
              />
              <AnswerRow
                label="Phone"
                value={valueOrMissing(submission.emergencyContact?.phone)}
                missing={!submission.emergencyContact?.phone}
              />
              <AnswerRow
                label="Relationship"
                value={valueOrMissing(submission.emergencyContact?.relationship)}
                missing={!submission.emergencyContact?.relationship}
              />
            </DetailSection>

            <DetailSection
              title={questionnaireSectionLabels.otherWaysToHelp}
              sectionKey="otherWaysToHelp"
              completedSections={sectionProgress.sections}
              flaggedSections={flaggedSections}
            >
              <OtherHelpSummary submission={submission} />
            </DetailSection>

            <DetailSection title="Review Notes">
              <AnswerRow
                label="Review summary"
                value={valueOrMissing(submission.review.summary, "No review summary yet")}
                missing={!submission.review.summary}
              />
              <AnswerRow
                label="Reviewed by"
                value={valueOrMissing(submission.reviewedBy)}
                missing={!submission.reviewedBy}
              />
              <AnswerRow label="Reviewed at" value={formatDate(submission.reviewedAt)} />
              {submission.review.notes.length > 0 ? (
                submission.review.notes.map((note) => (
                  <AnswerRow
                    key={note.id}
                    label={`${note.author} - ${formatDate(note.createdAt)}`}
                    value={note.message}
                  />
                ))
              ) : (
                <AnswerRow label="Notes" value="No notes yet" missing />
              )}
            </DetailSection>
          </section>
    </AdminShell>
  );
}
