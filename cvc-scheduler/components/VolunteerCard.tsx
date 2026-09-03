import { Button } from "./Button";
import { StatusPill } from "./StatusPill";
import { Mail, Phone } from "lucide-react";
import type { VolunteerProfile } from "@/lib/volunteers/profile";

type VolunteerCardProps = {
  volunteer: VolunteerProfile;
  canEdit: boolean;
  onMobileEdit?: () => void;
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
  if (lifecycle === "inactive") return "inactive";
  return "active";
}

function readinessLabel(readiness: VolunteerProfile["readinessStatus"]) {
  return readiness === "ready" ? "Schedule-ready" : "On hold";
}

export function VolunteerCard({
  volunteer,
  canEdit,
  onMobileEdit,
  updateAction,
}: VolunteerCardProps) {
  const sourceLabel =
    volunteer.profileSource === "manual" ? "Added directly" : "From questionnaire";
  const initials = volunteer.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <article className="bg-white transition hover:bg-blue-50/20">
      <div className="grid min-w-0 gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:grid-cols-[minmax(210px,1.3fr)_minmax(190px,1fr)_minmax(150px,.8fr)_auto] lg:items-center lg:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pl-blue-soft)] text-xs font-bold text-[var(--pl-blue)] ring-1 ring-blue-100">
            {initials}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--pl-ink)]">
              {volunteer.fullName}
            </h2>
            <p className="mt-0.5 truncate text-xs text-[var(--pl-muted)]">
              {volunteer.congregation ?? "No congregation listed"}
            </p>
          </div>
        </div>

        <div className="min-w-0 space-y-1 text-xs text-[var(--pl-text)]">
          {volunteer.email ? (
            <a className="flex min-w-0 items-center gap-2 hover:text-[var(--pl-blue)]" href={`mailto:${volunteer.email}`}>
              <Mail aria-hidden="true" className="size-3.5 shrink-0 text-[var(--pl-blue)]" />
              <span className="truncate">{volunteer.email}</span>
            </a>
          ) : <p>No email listed</p>}
          {volunteer.phone ? (
            <a className="flex items-center gap-2 hover:text-[var(--pl-blue)]" href={`tel:${volunteer.phone}`}>
              <Phone aria-hidden="true" className="size-3.5 shrink-0 text-[var(--pl-blue)]" />
              {volunteer.phone}
            </a>
          ) : <p>No phone listed</p>}
        </div>

        <div className="min-w-0 text-xs leading-5 text-[var(--pl-muted)]">
          <p className="truncate"><span className="font-semibold text-[var(--pl-text)]">Contact:</span> {volunteer.preferredContactMethod ?? "Not set"}</p>
          <p className="truncate"><span className="font-semibold text-[var(--pl-text)]">Source:</span> {sourceLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            {readinessLabel(volunteer.readinessStatus)}
          </span>
          <StatusPill status={lifecycleLabel(volunteer.lifecycle)} />
        </div>
      </div>

      <div className="grid gap-2 border-t border-[var(--pl-border)]/70 bg-[var(--pl-surface-subtle)]/55 px-4 py-2.5 text-xs leading-5 text-[var(--pl-muted)] sm:grid-cols-2 lg:px-5">
        <p className="truncate"><span className="font-semibold text-[var(--pl-text)]">Notes:</span> {volunteer.profileNotes || "No notes yet"}</p>
        <p className="truncate"><span className="font-semibold text-[var(--pl-text)]">Availability:</span> {summarizeSnapshot(volunteer.availabilitySnapshot)}</p>
      </div>

      {canEdit && updateAction ? (
        <>
          <button
            className="w-full border-t border-[var(--pl-border)] px-4 py-3 text-left text-xs font-semibold text-[var(--pl-blue)] hover:bg-[var(--pl-blue-soft)] sm:hidden"
            onClick={onMobileEdit}
            type="button"
          >
            Edit volunteer
          </button>
          <details className="group hidden border-t border-[var(--pl-border)] bg-white sm:block">
            <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-semibold text-[var(--pl-blue)] marker:hidden hover:bg-[var(--pl-blue-soft)] lg:px-5">
              Edit volunteer
            </summary>
            <form action={updateAction} className="grid gap-3 border-t border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] p-4 lg:p-5">
              <input name="profileId" type="hidden" value={volunteer.id} />
              <VolunteerFields volunteer={volunteer} />
              <Button className="mt-1 w-full sm:w-auto" type="submit">
                Save changes
              </Button>
            </form>
          </details>
        </>
      ) : (
        <p className="border-t border-[var(--pl-border)] px-4 py-2.5 text-xs font-medium text-[var(--pl-muted)] lg:px-5">
          Editing is unavailable for this signed-in contact.
        </p>
      )}
    </article>
  );
}

export function VolunteerFields({ volunteer }: { volunteer?: VolunteerProfile }) {
  const fieldClassName = "mt-1.5 min-h-[42px] w-full rounded-[var(--pl-radius-control)] border border-[var(--pl-border)] bg-white px-3.5 text-sm text-[var(--pl-ink)] outline-none transition placeholder:text-[var(--pl-muted)] focus:border-blue-300 focus:ring-2 focus:ring-blue-100";
  const selectClassName = `${fieldClassName} font-medium`;

  return (
    <>
      <label className="block">
        <span className="text-sm font-medium text-slate-600">Full name</span>
        <input
          className={fieldClassName}
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
            className={fieldClassName}
            defaultValue={volunteer?.email ?? ""}
            maxLength={254}
            name="email"
            type="email"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Phone</span>
          <input
            className={fieldClassName}
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
            className={fieldClassName}
            defaultValue={volunteer?.congregation ?? ""}
            maxLength={160}
            name="congregation"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Preferred contact</span>
          <select
            className={selectClassName}
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
            className={selectClassName}
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
            className={selectClassName}
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
          className={`${fieldClassName} min-h-24 py-3`}
          defaultValue={volunteer?.profileNotes ?? ""}
          maxLength={4000}
          name="profileNotes"
        />
      </label>
    </>
  );
}
