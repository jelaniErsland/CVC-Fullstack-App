import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/EmptyState";
import { ScheduleWeekView } from "@/components/ScheduleWeekView";
import {
  demoProjectId,
  getProjectById,
  getScheduleAssignmentCounts,
  getScheduleDayGroups,
  projectHasModule,
} from "@/lib/mockData";

export default function AdminSchedulePage() {
  const project = getProjectById(demoProjectId);
  const dayGroups = getScheduleDayGroups(demoProjectId);
  const counts = getScheduleAssignmentCounts(demoProjectId);
  const hasScheduleModule = projectHasModule(project, "scheduling");

  return (
    <AdminShell active="schedule">
      <header className="rounded-2xl border border-white/60 bg-white/28 px-5 py-5 backdrop-blur-xl sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          Belgrade Remodel
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Schedule
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          See the project week, open coverage, and assigned volunteers before a full
          scheduling workflow exists.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          This is a mock scheduling foundation. It uses schedule-ready volunteer data for
          review only and does not create, edit, or confirm assignments yet.
        </p>
      </header>

      <section className="mt-6">
        {project && hasScheduleModule ? (
          <ScheduleWeekView counts={counts} dayGroups={dayGroups} project={project} />
        ) : (
          <EmptyState
            title="Schedule module is not enabled"
            message="This workspace is not using scheduling yet. Enable the module later to show project assignments here."
          />
        )}
      </section>
    </AdminShell>
  );
}
