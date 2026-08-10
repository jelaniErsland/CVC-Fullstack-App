import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AdminShell } from "@/components/AdminShell";
import { GlassCard } from "@/components/GlassCard";
import { VolunteerDirectory } from "@/components/VolunteerDirectory";
import {
  createManualVolunteerProfileWithClient,
  manualVolunteerInputFromFormData,
  updateVolunteerProfileManualFieldsWithClient,
} from "@/lib/volunteers/server";
import {
  readVolunteerManagementRouteContext,
  readVolunteerManagementRouteState,
  type VolunteerManagementReadyRouteState,
  type VolunteerManagementRouteState,
} from "@/lib/volunteers/routeRead.server";
import { normalizeWorkspaceReference } from "@/lib/workspaces/identity";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type AdminVolunteersPageProps = Readonly<{
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>;

async function createManualVolunteerAction(formData: FormData) {
  "use server";

  let notice = "error";
  try {
    const routeContext = await readVolunteerManagementRouteContext();
    if (!routeContext || !routeContext.canEdit) {
      notice = "unavailable";
    } else {
      const input = manualVolunteerInputFromFormData(formData);
      await createManualVolunteerProfileWithClient(
        routeContext.supabase,
        routeContext.workspace.id,
        input,
      );
      notice = "created";
    }
  } catch (error) {
    notice = error instanceof Error && error.message.includes("invalid") ? "validation" : "error";
  }

  revalidatePath("/admin/volunteers");
  redirect(`/admin/volunteers?notice=${notice}`);
}

async function updateVolunteerProfileAction(formData: FormData) {
  "use server";

  let notice = "error";
  try {
    const routeContext = await readVolunteerManagementRouteContext();
    const profileId = formData.get("profileId");
    if (!routeContext || !routeContext.canEdit || typeof profileId !== "string") {
      notice = "unavailable";
    } else {
      const normalizedProfileId = normalizeWorkspaceReference({ id: profileId }).value;
      const input = manualVolunteerInputFromFormData(formData);
      await updateVolunteerProfileManualFieldsWithClient(
        routeContext.supabase,
        normalizedProfileId,
        input,
      );
      notice = "updated";
    }
  } catch (error) {
    notice = error instanceof Error && error.message.includes("invalid") ? "validation" : "error";
  }

  revalidatePath("/admin/volunteers");
  redirect(`/admin/volunteers?notice=${notice}`);
}

function Notice({ notice }: { notice: string | null }) {
  if (!notice) return null;
  const copy: Record<string, { title: string; message: string }> = {
    created: {
      title: "Volunteer saved",
      message: "They’re ready to review and schedule.",
    },
    updated: {
      title: "Volunteer updated",
      message: "Your changes are saved.",
    },
    validation: {
      title: "Check the volunteer details",
      message: "Name and at least one contact method are required, and fields must stay within the supported format.",
    },
    unavailable: {
      title: "Volunteer editing is unavailable",
      message: "This signed-in project contact cannot safely make volunteer profile changes right now.",
    },
    error: {
      title: "Volunteer change was not saved",
      message: "Something went wrong while saving. Please try again.",
    },
  };
  const selected = copy[notice];
  if (!selected) return null;
  return (
    <div
      aria-live="polite"
      className="mt-4 flex flex-col gap-0.5 rounded-xl border border-[var(--pl-blue)]/15 bg-[var(--pl-blue-soft)] px-4 py-2.5 sm:flex-row sm:items-baseline sm:gap-2"
    >
      <p className="text-sm font-semibold text-[var(--pl-ink)]">{selected.title}</p>
      <p className="text-xs leading-5 text-[var(--pl-text)]">{selected.message}</p>
    </div>
  );
}

function isReadyVolunteerState(
  state: VolunteerManagementRouteState,
): state is VolunteerManagementReadyRouteState {
  return state.kind === "ready_with_profiles" || state.kind === "ready_empty";
}

function VolunteerContent({ state }: { state: VolunteerManagementRouteState }) {
  if (!isReadyVolunteerState(state)) {
    return (
      <GlassCard className="p-5 sm:p-6">
        <p className="text-lg font-semibold text-slate-950">{state.title}</p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          {state.message}
        </p>
      </GlassCard>
    );
  }

  return (
    <VolunteerDirectory
      canEdit={state.canEdit}
      congregations={[
        ...new Set(
          state.profiles
            .map((profile) => profile.congregation)
            .filter((item): item is string => Boolean(item)),
        ),
      ].sort((a, b) => a.localeCompare(b))}
      createAction={createManualVolunteerAction}
      updateAction={updateVolunteerProfileAction}
      volunteers={state.profiles}
    />
  );
}

export default async function AdminVolunteersPage({
  searchParams,
}: AdminVolunteersPageProps) {
  const state = await readVolunteerManagementRouteState(await searchParams);
  const isReadyState = isReadyVolunteerState(state);

  const stats =
    isReadyState
      ? [
          { label: "volunteer", value: state.profiles.length },
          {
            label: "schedule-ready",
            value: state.profiles.filter((profile) => profile.readinessStatus === "ready")
              .length,
          },
          {
            label: "active",
            value: state.profiles.filter((profile) => profile.lifecycle === "active").length,
          },
        ]
      : [
          { label: "volunteer", value: "—" },
          { label: "schedule-ready", value: "—" },
          { label: "active", value: "—" },
        ];

  return (
    <AdminShell active="volunteers" workspaceName={isReadyState ? state.workspaceName : undefined}>
      <header className="flex flex-col gap-4 border-b border-[var(--pl-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pl-blue)]">
            {isReadyState ? state.workspaceName : "People"}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] text-[var(--pl-ink)] sm:text-4xl">
            Volunteers
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--pl-text)]">
            Search contact details and keep the scheduling directory current.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-[var(--pl-muted)]">
          {stats.map((stat) => (
            <span key={stat.label}>
              <strong className="mr-1 text-base font-bold text-[var(--pl-ink)]">{stat.value}</strong>
              {stat.label}{stat.label === "volunteer" && stat.value !== 1 ? "s" : ""}
            </span>
          ))}
        </div>
      </header>

      <Notice notice={state.notice} />

      <section className="mt-5">
        <VolunteerContent state={state} />
      </section>
    </AdminShell>
  );
}
