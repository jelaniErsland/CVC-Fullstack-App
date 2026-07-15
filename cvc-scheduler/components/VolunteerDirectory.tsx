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
    <details className="mb-6 rounded-3xl border border-white/70 bg-white/54 p-5 shadow-sm sm:p-6">
      <summary className="cursor-pointer text-base font-semibold text-slate-900">
        Add volunteer
      </summary>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
        Create a permanent manual profile for scheduling. This does not create a
        questionnaire submission and does not send volunteer email.
      </p>
      <form action={createAction} className="mt-5 grid gap-3">
        <VolunteerFields />
        <Button className="mt-1 w-full sm:w-auto" type="submit">
          Save volunteer
        </Button>
      </form>
    </details>
  ) : (
    <div className="mb-6 rounded-3xl border border-white/70 bg-white/54 p-5 text-sm leading-6 text-slate-500 shadow-sm">
      Volunteer profile editing is unavailable for this signed-in contact.
    </div>
  );

  return (
    <div>
      {addForm}
      <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Search</span>
          <input
            className="mt-2 min-h-12 w-full rounded-full border border-white/80 bg-white/64 px-5 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white/86 focus:ring-2 focus:ring-slate-300/60"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, congregation, email, phone, notes"
            type="search"
            value={query}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-600">Congregation</span>
          <select
            className="mt-2 min-h-12 w-full rounded-full border border-white/80 bg-white/64 px-5 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-300 focus:bg-white/86 focus:ring-2 focus:ring-slate-300/60"
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
          <span className="text-sm font-medium text-slate-600">Lifecycle</span>
          <select
            className="mt-2 min-h-12 w-full rounded-full border border-white/80 bg-white/64 px-5 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-300 focus:bg-white/86 focus:ring-2 focus:ring-slate-300/60"
            onChange={(event) =>
              setLifecycle(event.target.value as VolunteerProfile["lifecycle"] | "all")
            }
            value={lifecycle}
          >
            {lifecycles.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "All lifecycles" : item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-500">
        <p>
          {filteredVolunteers.length} of {volunteers.length} volunteers
        </p>
        {(query || congregation !== "all" || lifecycle !== "all") && (
          <button
            className="rounded-full px-3 py-2 font-semibold text-slate-600 transition hover:bg-white/56 hover:text-slate-950"
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

      {filteredVolunteers.length > 0 ? (
        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
        <div className="mt-5">
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
