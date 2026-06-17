import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { Button } from "@/components/Button";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { StatusPill } from "@/components/StatusPill";
import { getVolunteerById, projectVolunteers } from "@/lib/mockData";
import type { ProjectVolunteer } from "@/lib/mockData";

type AdminVolunteerDetailPageProps = {
  params: Promise<{
    volunteerId: string;
  }>;
};

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <GlassCard className="p-5 sm:p-6">
      <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
      <div className="mt-5 grid gap-3 text-sm leading-6 text-slate-600">{children}</div>
    </GlassCard>
  );
}

function OtherHelpList({ volunteer }: { volunteer: ProjectVolunteer }) {
  const helpItems = [
    ["Housing", volunteer.otherWaysToHelp.housing],
    ["Transportation", volunteer.otherWaysToHelp.transportation],
    ["Laundry / dry cleaning", volunteer.otherWaysToHelp.laundryDryCleaning],
    ["Housekeeping", volunteer.otherWaysToHelp.housekeeping],
    ["Hair care", volunteer.otherWaysToHelp.hairCare],
    ["Medical support", volunteer.otherWaysToHelp.medicalSupport],
    ["Food service", volunteer.otherWaysToHelp.foodService],
  ].filter(([, enabled]) => enabled);

  return (
    <>
      <p>{helpItems.map(([label]) => label).join(", ") || "No other categories selected."}</p>
      {volunteer.otherWaysToHelp.medicalSupportDetails ? (
        <p>Medical support details: {volunteer.otherWaysToHelp.medicalSupportDetails}</p>
      ) : null}
      {volunteer.otherWaysToHelp.other ? <p>Other: {volunteer.otherWaysToHelp.other}</p> : null}
      {volunteer.otherWaysToHelp.otherHelpDetails ? (
        <p>Other details: {volunteer.otherWaysToHelp.otherHelpDetails}</p>
      ) : null}
      <p>{volunteer.otherWaysToHelp.details || "No extra details provided."}</p>
      {volunteer.otherWaysToHelp.otherWaysDetails ? (
        <p>Additional details: {volunteer.otherWaysToHelp.otherWaysDetails}</p>
      ) : null}
    </>
  );
}

export function generateStaticParams() {
  return projectVolunteers.map((volunteer) => ({
    volunteerId: volunteer.id,
  }));
}

export default async function AdminVolunteerDetailPage({
  params,
}: AdminVolunteerDetailPageProps) {
  const { volunteerId } = await params;
  const volunteer = getVolunteerById(volunteerId);

  if (!volunteer) {
    notFound();
  }

  const primaryAction =
    volunteer.status === "Approved"
      ? "Edit Review"
      : volunteer.status === "Needs Info"
        ? "Mark Reviewed"
        : volunteer.status === "Not Approved"
          ? "Edit Review"
          : "Approve Volunteer";

  return (
    <PageShell>
      <div className="mx-auto grid min-h-[calc(100vh-40px)] w-full max-w-7xl gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="lg:py-4">
          <GlassCard className="p-4 lg:sticky lg:top-6">
            <Link href="/" className="block text-lg font-semibold tracking-tight text-slate-950">
              CVC Scheduler
            </Link>
            <AdminNav active="volunteers" />
          </GlassCard>
        </aside>

        <div className="py-4">
          <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <Link
                href="/admin/volunteers"
                className="text-sm font-medium text-slate-500 hover:text-slate-950"
              >
                Project Volunteers
              </Link>
              <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Submitted Questionnaire
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  {volunteer.name}
                </h1>
                <StatusPill status={volunteer.status} />
              </div>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Review this submitted questionnaire and choose the next kind step
                for the project team.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Button type="button">{primaryAction}</Button>
              <Button type="button" variant="secondary">
                Mark Needs Info
              </Button>
              <Button type="button" variant="secondary">
                Add Note
              </Button>
              <Button type="button" variant="ghost">
                Export Questionnaire PDF
              </Button>
            </div>
          </header>

          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            <DetailCard title="Contact Information">
              <p>{volunteer.congregation} Congregation</p>
              <a className="break-words hover:text-slate-950" href={`mailto:${volunteer.email}`}>
                {volunteer.email}
              </a>
              <a className="hover:text-slate-950" href={`tel:${volunteer.phone}`}>
                {volunteer.phone}
              </a>
              <p>Date of birth: {volunteer.dateOfBirth}</p>
            </DetailCard>

            <DetailCard title="Emergency Contact">
              <p>{volunteer.emergencyContact.name}</p>
              <a className="hover:text-slate-950" href={`tel:${volunteer.emergencyContact.phone}`}>
                {volunteer.emergencyContact.phone}
              </a>
              <p>Relationship: {volunteer.emergencyContact.relationship}</p>
            </DetailCard>

            <DetailCard title="Availability">
              <p>Available days: {volunteer.availability.weekdays.join(", ")}</p>
              <p>Two or more days per week: {yesNo(volunteer.availability.twoOrMoreDays)}</p>
              {volunteer.availability.twoOrMoreDaysDetails ? (
                <p>Details: {volunteer.availability.twoOrMoreDaysDetails}</p>
              ) : null}
              <p>After-hours security: {yesNo(volunteer.availability.afterHoursSecurity)}</p>
              {volunteer.availability.afterHoursSecurityDetails ? (
                <p>Security details: {volunteer.availability.afterHoursSecurityDetails}</p>
              ) : null}
            </DetailCard>

            <DetailCard title="Skills & Experience">
              <p>
                Construction skills:{" "}
                {volunteer.skillsExperience.construction.join(", ") || "None listed"}
              </p>
              <p>
                Maintenance task cards: {yesNo(volunteer.skillsExperience.maintenanceTaskCards)}
              </p>
              <p>
                Task cards: {volunteer.skillsExperience.taskCards || "No task cards listed"}
              </p>
              {volunteer.skillsExperience.taskCardAdditionalDetails ? (
                <p>Task card details: {volunteer.skillsExperience.taskCardAdditionalDetails}</p>
              ) : null}
              <p>
                Physical work in hot/cold conditions:{" "}
                {yesNo(volunteer.skillsExperience.physicalWorkConditions)}
              </p>
              {volunteer.skillsExperience.physicalWorkConditionsDetails ? (
                <p>
                  Physical work details:{" "}
                  {volunteer.skillsExperience.physicalWorkConditionsDetails}
                </p>
              ) : null}
            </DetailCard>

            <DetailCard title="Other Ways They Can Help">
              <OtherHelpList volunteer={volunteer} />
            </DetailCard>

            <DetailCard title="Questionnaire Status">
              <p>Status: {volunteer.status}</p>
              <p>Submitted: {volunteer.submittedAt}</p>
              <p>Export as PDF is coming soon.</p>
            </DetailCard>

            <DetailCard title="Notes">
              {volunteer.notes.length > 0 ? (
                volunteer.notes.map((note) => <p key={note}>{note}</p>)
              ) : (
                <p>No notes yet.</p>
              )}
            </DetailCard>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
