"use client";

import { useMemo, useState } from "react";
import type { Project } from "@/lib/mockData";

type ProjectComboboxProps = {
  projects: Project[];
};

export function ProjectCombobox({ projects }: ProjectComboboxProps) {
  const firstProject = projects[0];
  const [query, setQuery] = useState(firstProject?.name ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | undefined>(firstProject);

  const filteredProjects = useMemo(() => {
    const searchableQuery = selectedProject?.name === query && isOpen ? "" : query;
    const normalizedQuery = searchableQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return projects;
    }

    return projects.filter((project) =>
      [project.name, project.location, project.phase]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [isOpen, projects, query, selectedProject?.name]);

  function selectProject(project: Project) {
    setSelectedProject(project);
    setQuery(project.name);
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <label className="block" htmlFor="project">
        <span className="mb-2 block text-sm font-medium text-slate-700">Project</span>
        <input
          id="project"
          type="search"
          value={query}
          autoComplete="off"
          placeholder="Search by project or city"
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedProject(undefined);
            setIsOpen(true);
          }}
          onFocus={(event) => {
            if (selectedProject?.name === query) {
              event.currentTarget.value = "";
              setQuery("");
              setSelectedProject(undefined);
            }

            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false);
            }
          }}
          className="h-[54px] w-full rounded-lg border border-white/80 bg-white/72 px-4 pr-11 text-base text-slate-950 shadow-inner shadow-white/35 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white/90 focus:ring-4 focus:ring-slate-200/70"
        />
      </label>

      <input type="hidden" name="projectId" value={selectedProject?.id ?? ""} />

      <button
        type="button"
        aria-label="Show project options"
        onClick={() => setIsOpen((current) => !current)}
        className="absolute right-3 top-9 flex size-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
      >
        <span aria-hidden="true" className="text-sm">
          V
        </span>
      </button>

      {isOpen ? (
        <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-lg border border-white/80 bg-white/92 p-2 shadow-[0_20px_50px_rgba(15,23,42,0.14)] backdrop-blur-2xl">
          {filteredProjects.length > 0 ? (
            filteredProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectProject(project)}
                className="block w-full rounded-lg px-3 py-3 text-left transition hover:bg-slate-100/80"
              >
                <span className="block text-sm font-semibold text-slate-950">
                  {project.name}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {project.location} - {project.phase}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-4 text-sm leading-6 text-slate-500">
              No projects match that search yet.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
