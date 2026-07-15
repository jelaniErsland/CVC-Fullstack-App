import { Button } from "./Button";
import { GlassCard } from "./GlassCard";
import { StatusPill } from "./StatusPill";
import type { VolunteerProfile } from "@/lib/volunteers/profile";

type VolunteerCardProps = {
  volunteer: VolunteerProfile;
  canEdit: boolean;
  updateAction?: (formData: FormData) => void | Promise<void>;
};

function summarizeSnapshot(snapshot: Readonly<Record<string, unknown>>) {
  const textValues = Object.values(snapshot)
    .flatMap((value) => {
      if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
      if (typeof value === "string") return [value];
      return [];
    })
    .slice(0, 3);
  return textValues.join(", ") || "No schedule notes yet";
}

function lifecycleLabel(lifecycle: VolunteerProfile["lifecycle"]) {
  if (lifecycle === "archived") return "archived";
  if (lifecycle === "inactive") return "Draft";
  return "active";
}

function readinessLabel(readiness: VolunteerProfile["readinessStatus"]) {
  return readiness === "ready" ? "Schedule-ready" : "On hold";
}

export function VolunteerCard({ volunteer, canEdit, updateAction }: VolunteerCardProps) {
  const sourceLabel =
    volunteer.profileSource === "manual" ? "Manual profile" : "Questionnaire profile";

  return (
    <GlassCard className="flex h-full flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:bg-white/72 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {volunteer.congregation ?? "No congregation listed"}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {volunteer.fullName}
          </h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            {sourceLabel}
          </p>
        </div>
        <StatusPill status={lifecycleLabel(volunteer.lifecycle)} />
      </div>

      <div className="mt-5 grid gap-2 text-sm leading-6 text-slate-600">
        {volunteer.email ? (
          <a className="break-words hover:text-slate-950" href={`mailto:${volunteer.email}`}>
            {volunteer.email}
          </a>
        ) : (
          <p>No email listed</p>
        )}
        {volunteer.phone ? (
          <a className="hover:text-slate-950" href={`tel:${volunteer.phone}`}>
            {volunteer.phone}
          </a>
        ) : (
          <p>No phone listed</p>
        )}
      </div>

      <div className="mt-5 grid gap-3 text-sm leading-6 text-slate-600">
        <p>
          <span className="font-medium text-slate-800">Preferred contact:</span>{" "}
          {volunteer.preferredContactMethod ?? "Not set"}
        </p>
        <p>
          <span className="font-medium text-slate-800">Readiness:</span>{" "}
          {readinessLabel(volunteer.readinessStatus)}
        </p>
        <p>
          <span className="font-medium text-slate-800">Profile notes:</span>{" "}
          {volunteer.profileNotes || "No notes yet"}
        </p>
        <p>
          <span className="font-medium text-slate-800">Snapshot:</span>{" "}
          {summarizeSnapshot(volunteer.availabilitySnapshot)}
        </p>
      </div>

      {canEdit && updateAction ? (
        <details className="mt-6 rounded-2xl border border-white/70 bg-white/42 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            Edit volunteer
          </summary>
          <form action={updateAction} className="mt-4 grid gap-3">
            <input name="profileId" type="hidden" value={volunteer.id} />
            <VolunteerFields volunteer={volunteer} />
            <Button className="mt-1 w-full" type="submit" variant="secondary">
              Save changes
            </Button>
          </form>
        </details>
      ) : (
        <p className="mt-6 rounded-2xl border border-white/70 bg-white/42 px-4 py-3 text-sm font-medium text-slate-500">
          Editing is unavailable for this signed-in contact.
        </p>
      )}
    </GlassCard>
  );
}

export function VolunteerFields({ volunteer }: { volunteer?: VolunteerProfile }) {
  return (
    <>
      <label className="block">
        <span className="text-sm font-medium text-slate-600">Full name</span>
        <input
          className="mt-2 min-h-11 w-full rounded-2xl border border-white/80 bg-white/70 px-4 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-300/60"
          defaultValue={volunteer?.fullName ?? ""}
          maxLength={160}
          name="fullName"
          required
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Email</span>
          <input
            className="mt-2 min-h-11 w-full rounded-2xl border border-white/80 bg-white/70 px-4 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-300/60"
            defaultValue={volunteer?.email ?? ""}
            maxLength={254}
            name="email"
            type="email"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Phone</span>
          <input
            className="mt-2 min-h-11 w-full rounded-2xl border border-white/80 bg-white/70 px-4 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-300/60"
            defaultValue={volunteer?.phone ?? ""}
            maxLength={40}
            name="phone"
            type="tel"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Congregation</span>
          <input
            className="mt-2 min-h-11 w-full rounded-2xl border border-white/80 bg-white/70 px-4 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-300/60"
            defaultValue={volunteer?.congregation ?? ""}
            maxLength={160}
            name="congregation"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Preferred contact</span>
          <select
            className="mt-2 min-h-11 w-full rounded-2xl border border-white/80 bg-white/70 px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-300/60"
            defaultValue={volunteer?.preferredContactMethod ?? ""}
            name="preferredContactMethod"
          >
            <option value="">Not set</option>
            <option value="Text">Text</option>
            <option value="Phone">Phone</option>
            <option value="Email">Email</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Lifecycle</span>
          <select
            className="mt-2 min-h-11 w-full rounded-2xl border border-white/80 bg-white/70 px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-300/60"
            defaultValue={volunteer?.lifecycle ?? "active"}
            name="lifecycle"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Scheduling readiness</span>
          <select
            className="mt-2 min-h-11 w-full rounded-2xl border border-white/80 bg-white/70 px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-300/60"
            defaultValue={volunteer?.readinessStatus ?? "ready"}
            name="readinessStatus"
          >
            <option value="ready">Ready</option>
            <option value="on_hold">On hold</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium text-slate-600">Profile notes</span>
        <textarea
          className="mt-2 min-h-24 w-full rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-300/60"
          defaultValue={volunteer?.profileNotes ?? ""}
          maxLength={4000}
          name="profileNotes"
        />
      </label>
    </>
  );
}
