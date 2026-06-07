"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "./EmptyState";
import { VolunteerCard } from "./VolunteerCard";
import type { Volunteer } from "@/lib/mockData";

type VolunteerDirectoryProps = {
  volunteers: Volunteer[];
  congregations: string[];
};

export function VolunteerDirectory({
  volunteers,
  congregations,
}: VolunteerDirectoryProps) {
  const [query, setQuery] = useState("");
  const [congregation, setCongregation] = useState("all");

  const filteredVolunteers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return volunteers.filter((volunteer) => {
      const matchesCongregation =
        congregation === "all" || volunteer.congregation === congregation;
      const searchableText = [
        volunteer.name,
        volunteer.email,
        volunteer.phone,
        volunteer.congregation,
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery =
        normalizedQuery.length === 0 || searchableText.includes(normalizedQuery);

      return matchesCongregation && matchesQuery;
    });
  }, [congregation, query, volunteers]);

  if (volunteers.length === 0) {
    return (
      <EmptyState
        title="No volunteers yet"
        message="Volunteer profiles will appear here once the roster has been created."
      />
    );
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Search</span>
          <input
            className="mt-2 min-h-12 w-full rounded-full border border-white/80 bg-white/64 px-5 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white/86 focus:ring-2 focus:ring-slate-300/60"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, email, phone, congregation"
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
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-500">
        <p>
          {filteredVolunteers.length} of {volunteers.length} volunteers
        </p>
        {(query || congregation !== "all") && (
          <button
            className="rounded-full px-3 py-2 font-semibold text-slate-600 transition hover:bg-white/56 hover:text-slate-950"
            onClick={() => {
              setQuery("");
              setCongregation("all");
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
            <VolunteerCard key={volunteer.id} volunteer={volunteer} />
          ))}
        </section>
      ) : (
        <div className="mt-5">
          <EmptyState
            title="No search results"
            message="Try a different name, email, phone number, or congregation filter."
          />
        </div>
      )}
    </div>
  );
}
