import { Button } from "./Button";
import { StatusPill } from "./StatusPill";
import { CalendarDays, ClipboardList, Mail, MessageCircle, NotebookPen, Phone, Trash2 } from "lucide-react";
import { volunteerAge, volunteerOperationalSummary, volunteerWeekdays, type VolunteerProfile } from "@/lib/volunteers/profile";

type VolunteerCardProps = {
  volunteer: VolunteerProfile;
  canEdit: boolean;
  onDeleteRequest?: () => void;
  onMobileEdit?: () => void;
  updateAction?: (formData: FormData) => void | Promise<void>;
};

function lifecycleLabel(lifecycle: VolunteerProfile["lifecycle"]) {
  if (lifecycle === "archived") return "archived";
  if (lifecycle === "inactive") return "inactive";
  return "active";
}

function readinessLabel(readiness: VolunteerProfile["readinessStatus"]) {
  return readiness === "ready" ? "Schedule-ready" : "On hold";
}

function preferredContactLabel(method: VolunteerProfile["preferredContactMethod"]) {
  if (!method) return "No preference";
  return `${method[0]?.toUpperCase()}${method.slice(1)} preferred`;
}

export function VolunteerCard({
  volunteer,
  canEdit,
  onDeleteRequest,
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
  const operationalSummary = volunteerOperationalSummary(volunteer);

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

        <div className="min-w-0 space-y-1 text-xs leading-5 text-[var(--pl-muted)]">
          <p className="flex items-center gap-1.5 truncate">
            <MessageCircle aria-hidden="true" className="size-3.5 shrink-0 text-[var(--pl-blue)]" />
            <span className="sr-only">Preferred contact: </span>{preferredContactLabel(volunteer.preferredContactMethod)}
          </p>
          <p className="flex items-center gap-1.5 truncate">
            <ClipboardList aria-hidden="true" className="size-3.5 shrink-0 text-[var(--pl-muted)]" />
            <span className="sr-only">Source: </span>{sourceLabel.replace(/^From /, "")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            {readinessLabel(volunteer.readinessStatus)}
          </span>
          <StatusPill status={lifecycleLabel(volunteer.lifecycle)} />
        </div>
      </div>

      <div className="grid gap-2 border-t border-[var(--pl-border)]/70 bg-[var(--pl-surface-subtle)]/55 px-4 py-2.5 text-xs leading-5 text-[var(--pl-muted)] sm:grid-cols-2 lg:px-5">
        <p className="flex min-w-0 items-center gap-1.5 truncate">
          <NotebookPen aria-hidden="true" className="size-3.5 shrink-0 text-[var(--pl-muted)]" />
          <span className="sr-only">Notes: </span><span className="truncate">{volunteer.profileNotes || "No notes yet"}</span>
        </p>
        {operationalSummary ? <p className="flex min-w-0 items-center gap-1.5 truncate">
          <CalendarDays aria-hidden="true" className="size-3.5 shrink-0 text-[var(--pl-muted)]" />
          <span className="sr-only">Operational summary: </span><span className="truncate">{operationalSummary}</span>
        </p> : null}
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
            {onDeleteRequest ? (
              <div
                className="border-t border-[var(--pl-border)] bg-white px-4 py-3 lg:px-5"
              >
                <button
                  className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-[var(--pl-radius-control)] border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  onClick={onDeleteRequest}
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                  Delete volunteer
                </button>
              </div>
            ) : null}
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
      <section className="grid gap-3" aria-labelledby="volunteer-contact-heading">
      <h3 id="volunteer-contact-heading" className="text-sm font-semibold text-[var(--pl-ink)]">Contact</h3>
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
      </section>
      <details className="rounded-lg border border-[var(--pl-border)] bg-white" open>
        <summary className="cursor-pointer px-3.5 py-3 text-sm font-semibold text-[var(--pl-ink)]">Availability</summary>
        <div className="grid gap-3 border-t border-[var(--pl-border)] p-3.5">
          <fieldset><legend className="text-sm font-medium text-slate-600">Available work days</legend><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {volunteerWeekdays.map((day) => <label className="flex min-h-10 items-center gap-2 rounded border border-[var(--pl-border)] px-2 text-xs" key={day}><input defaultChecked={volunteer?.availableWorkDays.includes(day)} name="availableWorkDays" type="checkbox" value={day} />{day}</label>)}
          </div></fieldset>
          <TriStateSelect className={selectClassName} defaultValue={volunteer?.availableTwoPlusDays ?? "unknown"} label="Available 2+ days/week" name="availableTwoPlusDays" />
          <TriStateSelect className={selectClassName} defaultValue={volunteer?.afterHoursSecurityAvailability ?? "unknown"} label="Available for after-hours security" name="afterHoursSecurityAvailability" />
        </div>
      </details>
      <details className="rounded-lg border border-[var(--pl-border)] bg-white">
        <summary className="cursor-pointer px-3.5 py-3 text-sm font-semibold text-[var(--pl-ink)]">Skills &amp; support</summary>
        <div className="grid gap-3 border-t border-[var(--pl-border)] p-3.5">
          <TriStateSelect className={selectClassName} defaultValue={volunteer?.housingOption ?? "unknown"} label="Housing possible" name="housingOption" />
          <TriStateSelect className={selectClassName} defaultValue={volunteer?.builderAssistantCommunication ?? "unknown"} label="Builder Assistant communication" name="builderAssistantCommunication" />
          <label className="block"><span className="text-sm font-medium text-slate-600">Skills / experience</span><textarea className={`${fieldClassName} min-h-24 py-3`} defaultValue={volunteer?.skillsExperience ?? ""} maxLength={4000} name="skillsExperience" /></label>
          <label className="block"><span className="text-sm font-medium text-slate-600">Other support</span><textarea className={`${fieldClassName} min-h-24 py-3`} defaultValue={volunteer?.otherSupport ?? ""} maxLength={4000} name="otherSupport" /></label>
        </div>
      </details>
      <details className="rounded-lg border border-[var(--pl-border)] bg-white">
        <summary className="cursor-pointer px-3.5 py-3 text-sm font-semibold text-[var(--pl-ink)]">Private info</summary>
        <div className="grid gap-3 border-t border-[var(--pl-border)] p-3.5 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-medium text-slate-600">Date of birth{volunteerAge(volunteer?.dateOfBirth ?? null) !== null ? ` · Age ${volunteerAge(volunteer?.dateOfBirth ?? null)}` : ""}</span><input className={fieldClassName} defaultValue={volunteer?.dateOfBirth ?? ""} name="dateOfBirth" type="date" /></label>
          <label className="block"><span className="text-sm font-medium text-slate-600">Emergency contact name</span><input className={fieldClassName} defaultValue={volunteer?.emergencyContactName ?? ""} maxLength={160} name="emergencyContactName" /></label>
          <label className="block"><span className="text-sm font-medium text-slate-600">Emergency phone</span><input className={fieldClassName} defaultValue={volunteer?.emergencyContactPhone ?? ""} maxLength={40} name="emergencyContactPhone" type="tel" /></label>
          <label className="block"><span className="text-sm font-medium text-slate-600">Relationship</span><input className={fieldClassName} defaultValue={volunteer?.emergencyContactRelationship ?? ""} maxLength={160} name="emergencyContactRelationship" /></label>
        </div>
      </details>
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

function TriStateSelect({ className, defaultValue, label, name }: { className: string; defaultValue: string; label: string; name: string }) {
  return <label className="block"><span className="text-sm font-medium text-slate-600">{label}</span><select className={className} defaultValue={defaultValue} name={name}><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select></label>;
}
