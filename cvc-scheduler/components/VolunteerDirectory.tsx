"use client";

import { useMemo, useState } from "react";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { VolunteerCard, VolunteerFields } from "./VolunteerCard";
import type { VolunteerProfile } from "@/lib/volunteers/profile";

type VolunteerDirectoryProps = {
  volunteers: readonly VolunteerProfile[];
  congregations: string[];
  canEdit: boolean;
  createAction?: (formData: FormData) => void | Promise<void>;
  updateAction?: (formData: FormData) => void | Promise<void>;
};

const lifecycles: Array<VolunteerProfile["lifecycle"] | "all"> = [
  "all",
  "active",
  "inactive",
  "archived",
];

export function VolunteerDirectory({
  canEdit,
  createAction,
  updateAction,
  volunteers,
  congregations,
}: VolunteerDirectoryProps) {
  const [query, setQuery] = useState("");
  const [congregation, setCongregation] = useState("all");
  const [lifecycle, setLifecycle] = useState<VolunteerProfile["lifecycle"] | "all">("all");

  const filteredVolunteers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return volunteers.filter((volunteer) => {
      const matchesCongregation =
        congregation === "all" || volunteer.congregation === congregation;
      const matchesLifecycle = lifecycle === "all" || volunteer.lifecycle === lifecycle;
      const searchableText = [
        volunteer.fullName,
        volunteer.email,
        volunteer.phone,
        volunteer.congregation,
        volunteer.lifecycle,
        volunteer.readinessStatus,
        volunteer.profileNotes,
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery =
        normalizedQuery.length === 0 || searchableText.includes(normalizedQuery);

      return matchesCongregation && matchesLifecycle && matchesQuery;
    });
  }, [congregation, lifecycle, query, volunteers]);

  const addForm = canEdit && createAction ? (
    <details className="group border-b border-[var(--pl-border)] bg-white">
      <summary className="m-3 inline-flex min-h-[42px] cursor-pointer list-none items-center rounded-[var(--pl-radius-control)] bg-[var(--pl-blue)] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(23,105,255,0.18)] marker:hidden hover:bg-[var(--pl-blue-deep)] sm:m-4">
        + Add volunteer
      </summary>
      <div className="border-t border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] p-4 sm:p-5">
        <p className="max-w-2xl text-sm leading-6 text-[var(--pl-text)]">
          Add a name and at least one contact method. Saving does not send a message.
        </p>
        <form action={createAction} className="mt-4 grid gap-4">
          <VolunteerFields />
          <Button className="mt-1 w-full sm:w-auto" type="submit">
            Save volunteer
          </Button>
        </form>
      </div>
    </details>
  ) : (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
      Volunteer profile editing is unavailable for this signed-in contact.
    </div>
  );

  return (
    <div className="overflow-hidden rounded-[var(--pl-radius-panel)] border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-panel)]">
      {addForm}
      <div className="border-b border-[var(--pl-border)] bg-white p-3 sm:p-4">
      <div className="grid gap-2 md:grid-cols-[minmax(240px,1fr)_190px_160px]">
        <label className="block">
          <span className="sr-only">Search</span>
          <input
            className="min-h-[42px] w-full rounded-[var(--pl-radius-control)] border border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] px-3.5 text-sm text-[var(--pl-ink)] outline-none transition placeholder:text-[var(--pl-muted)] focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search volunteers"
            type="search"
            value={query}
          />
        </label>

        <label className="block">
          <span className="sr-only">Congregation</span>
          <select
            className="min-h-[42px] w-full rounded-[var(--pl-radius-control)] border border-[var(--pl-border)] bg-white px-3 text-sm font-medium text-[var(--pl-text)] outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            onChange={(event) => setCongregation(event.target.value)}
            value={congregation}
          >
            <option value="all">All congregations</option>
            {congregations.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="sr-only">Status</span>
          <select
            className="min-h-[42px] w-full rounded-[var(--pl-radius-control)] border border-[var(--pl-border)] bg-white px-3 text-sm font-medium text-[var(--pl-text)] outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            onChange={(event) =>
              setLifecycle(event.target.value as VolunteerProfile["lifecycle"] | "all")
            }
            value={lifecycle}
          >
            {lifecycles.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "All statuses" : item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--pl-muted)]">
        <p>
          {filteredVolunteers.length} of {volunteers.length} volunteers
        </p>
        {(query || congregation !== "all" || lifecycle !== "all") && (
          <button
            className="rounded-lg px-2.5 py-1.5 font-semibold text-[var(--pl-blue)] transition hover:bg-[var(--pl-blue-soft)]"
            onClick={() => {
              setQuery("");
              setCongregation("all");
              setLifecycle("all");
            }}
            type="button"
          >
            Clear
          </button>
        )}
      </div>
      </div>

      {filteredVolunteers.length > 0 ? (
        <section className="divide-y divide-[var(--pl-border)]">
          {filteredVolunteers.map((volunteer) => (
            <VolunteerCard
              canEdit={canEdit}
              key={volunteer.id}
              updateAction={updateAction}
              volunteer={volunteer}
            />
          ))}
        </section>
      ) : (
        <div>
          <EmptyState
            title={volunteers.length === 0 ? "No volunteers yet" : "No search results"}
            message={
              volunteers.length === 0
                ? "Add a manual volunteer profile when a Bozeman helper is ready to be scheduled."
                : "Try a different name, congregation, lifecycle, phone number, or note."
            }
          />
        </div>
      )}
    </div>
  );
}
