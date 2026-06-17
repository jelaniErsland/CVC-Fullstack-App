import { Button } from "./Button";
import { GlassCard } from "./GlassCard";
import { StatusPill } from "./StatusPill";
import type { ProjectVolunteer } from "@/lib/mockData";

type VolunteerCardProps = {
  volunteer: ProjectVolunteer;
};

function summarizeSkills(volunteer: ProjectVolunteer) {
  return volunteer.skillsExperience.construction.join(", ") || "No skills listed yet";
}

export function VolunteerCard({ volunteer }: VolunteerCardProps) {
  const availability = volunteer.availability.weekdays.join(", ") || "No days selected";

  return (
    <GlassCard className="flex h-full flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:bg-white/72 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{volunteer.congregation}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {volunteer.name}
          </h2>
        </div>
        <StatusPill status={volunteer.status} />
      </div>

      <div className="mt-5 grid gap-2 text-sm leading-6 text-slate-600">
        <a className="break-words hover:text-slate-950" href={`mailto:${volunteer.email}`}>
          {volunteer.email}
        </a>
        <a className="hover:text-slate-950" href={`tel:${volunteer.phone}`}>
          {volunteer.phone}
        </a>
      </div>

      <div className="mt-5 grid gap-3 text-sm leading-6 text-slate-600">
        <p>
          <span className="font-medium text-slate-800">Availability:</span> {availability}
        </p>
        <p>
          <span className="font-medium text-slate-800">Skills:</span>{" "}
          {summarizeSkills(volunteer)}
        </p>
        <p>
          <span className="font-medium text-slate-800">Security:</span>{" "}
          {volunteer.availability.afterHoursSecurity ? "Available" : "Not available"}
        </p>
      </div>

      <Button
        href={`/admin/volunteers/${volunteer.id}`}
        variant="secondary"
        className="mt-6 w-full"
      >
        View Details
      </Button>
    </GlassCard>
  );
}
