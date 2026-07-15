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
      message: "The new manual volunteer profile is now part of the persisted workspace truth.",
    },
    updated: {
      title: "Volunteer updated",
      message: "The volunteer profile changes were saved and will remain after reload.",
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
      message: "Something went wrong while saving. No mock volunteer fallback was used.",
    },
  };
  const selected = copy[notice];
  if (!selected) return null;
  return (
    <GlassCard className="mt-6 p-4">
      <p className="text-sm font-semibold text-slate-950">{selected.title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{selected.message}</p>
    </GlassCard>
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
          { label: "Permanent profiles", value: state.profiles.length },
          {
            label: "Schedule-ready",
            value: state.profiles.filter((profile) => profile.readinessStatus === "ready")
              .length,
          },
          {
            label: "Manual entries",
            value: state.profiles.filter((profile) => profile.profileSource === "manual")
              .length,
          },
          {
            label: "Active",
            value: state.profiles.filter((profile) => profile.lifecycle === "active").length,
          },
        ]
      : [
          { label: "Permanent profiles", value: "—" },
          { label: "Schedule-ready", value: "—" },
          { label: "Manual entries", value: "—" },
          { label: "Active", value: "—" },
        ];

  return (
    <AdminShell active="volunteers">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Current Project
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Project Volunteers
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            View, add, and edit permanent volunteer profiles for scheduling. This
            page uses persisted workspace truth and does not fall back to mock
            volunteers.
          </p>
        </div>
      </header>

      <Notice notice={state.notice} />

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <GlassCard key={stat.label} className="p-5">
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
              {stat.value}
            </p>
          </GlassCard>
        ))}
      </section>

      <section className="mt-6">
        <VolunteerContent state={state} />
      </section>
    </AdminShell>
  );
}
