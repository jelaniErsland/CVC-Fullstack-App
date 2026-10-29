import { PageHeader } from "@/components/PageHeader";
import { withReadTimeout } from "@/lib/readTimeout";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AdminShell } from "@/components/AdminShell";
import { GlassCard } from "@/components/GlassCard";
import { VolunteerDirectory } from "@/components/VolunteerDirectory";
import {
  emitOperationalEvent,
  type OperationalEventName,
} from "@/lib/observability/server";
import {
  createManualVolunteerProfileWithClient,
  manualVolunteerInputFromFormData,
  updateVolunteerProfileManualFieldsWithClient,
  readVolunteerProfileWithClient,
} from "@/lib/volunteers/server";
import {
  readVolunteerManagementRouteContext,
  readVolunteerManagementRouteState,
  type VolunteerManagementReadyRouteState,
  type VolunteerManagementRouteState,
} from "@/lib/volunteers/routeRead.server";
import { normalizeWorkspaceReference } from "@/lib/workspaces/identity";
import { readVolunteerScheduleWithClient, type VolunteerScheduleResult } from "@/lib/volunteers/schedule.server";
import type { VolunteerUpdateResult } from "@/lib/volunteers/updateResult";
import { classifyVolunteerCreatePersistenceFailure } from "@/lib/volunteers/createFailure";

import type { VolunteerDeletionReviewResult, VolunteerDeletionInput, VolunteerDeletionOutcome } from "@/lib/volunteers/deletion";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type AdminVolunteersPageProps = Readonly<{
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>;

async function readVolunteerProfileAction(profileId: string) {
  "use server";
  try {
    const context = await readVolunteerManagementRouteContext();
    if (!context) return null;
    return await withReadTimeout(readVolunteerProfileWithClient(context.supabase, context.workspace.id, profileId));
  } catch { return null; }
}

async function readVolunteerScheduleAction(profileId: string): Promise<VolunteerScheduleResult> {
  "use server";
  const context = await readVolunteerManagementRouteContext();
  if (!context || !context.capabilities.includes("calendar.view") || !context.capabilities.includes("assignments.view")) return { kind: "unavailable" };
  return readVolunteerScheduleWithClient({ client: context.supabase, workspaceId: context.workspace.id, profileId });
}

function observeVolunteerMutationFailure(
  event: Extract<
    OperationalEventName,
    "volunteer.create_failure" | "volunteer.update_failure"
  >,
  notice: "unavailable" | "validation" | "error",
) {
  emitOperationalEvent({
    event,
    failureCode:
      notice === "unavailable"
        ? "context_unavailable"
        : notice === "validation"
          ? "validation_failed"
          : "persistence_failed",
  });
}

async function reviewVolunteerDeletionAction(profileId: string): Promise<VolunteerDeletionReviewResult> {
  "use server";
  try {
    const context = await readVolunteerManagementRouteContext();
    if (!context?.canEdit) return { kind: "unavailable" };
    const { data, error } = await withReadTimeout(context.supabase.rpc("review_volunteer_deletion", {
      p_workspace_id: context.workspace.id, p_profile_id: normalizeWorkspaceReference({ id: profileId }).value,
    }));
    if (error || !data || typeof data !== "object" || Array.isArray(data)) return { kind: "error" };
    if (data.kind === "already_deleted") return { kind: "already_deleted" };
    if (data.kind !== "review" || typeof data.version !== "string" || typeof data.fingerprint !== "string" || typeof data.affectedCount !== "number") return { kind: "error" };
    return data as unknown as VolunteerDeletionReviewResult;
  } catch { return { kind: "error" }; }
}

async function deleteVolunteerProfileAction(input: VolunteerDeletionInput): Promise<VolunteerDeletionOutcome> {
  "use server";
  try {
    const context = await readVolunteerManagementRouteContext();
    if (!context?.canEdit) return { kind: "rejected", reason: "permission" };
    if (!input || typeof input.version !== "string" || !Number.isFinite(Date.parse(input.version)) || typeof input.fingerprint !== "string" || !/^[a-f0-9]{32}$/.test(input.fingerprint)) return { kind: "rejected", reason: "error" };
    const { data, error } = await context.supabase.rpc("delete_volunteer_profile", {
      p_workspace_id: context.workspace.id, p_profile_id: normalizeWorkspaceReference({ id: input.profileId }).value,
      p_expected_updated_at: input.version, p_expected_impact: input.fingerprint,
    });
    if (error) return { kind: "rejected", reason: error.code === "40001" ? "changed" : error.code === "42501" ? "permission" : "error" };
    if (!data || typeof data !== "object" || Array.isArray(data) || (data.kind !== "deleted" && data.kind !== "already_deleted")) return { kind: "rejected", reason: "error" };
    for (const path of ["/admin/volunteers", "/admin/calendar", "/admin/needs-attention", "/admin/announcements", "/admin"]) revalidatePath(path);
    return { kind: data.kind };
  } catch { return { kind: "rejected", reason: "error" }; }
}

async function createManualVolunteerAction(formData: FormData) {
  "use server";

  let notice: "unavailable" | "permission" | "duplicate" | "validation" | "error" | "created" = "error";
  try {
    const routeContext = await readVolunteerManagementRouteContext().catch(() => null);
    if (!routeContext || !routeContext.canEdit) {
      notice = "unavailable";
      observeVolunteerMutationFailure("volunteer.create_failure", "unavailable");
    } else {
      let input: ReturnType<typeof manualVolunteerInputFromFormData> | undefined;
      try {
        input = manualVolunteerInputFromFormData(formData);
      } catch {
        notice = "validation";
        observeVolunteerMutationFailure("volunteer.create_failure", "validation");
      }
      if (input) {
        try {
          await createManualVolunteerProfileWithClient(
            routeContext.supabase,
            routeContext.workspace.id,
            input,
          );
          notice = "created";
        } catch (error) {
          const failure = classifyVolunteerCreatePersistenceFailure(error);
          notice = failure.notice;
          emitOperationalEvent({ event: "volunteer.create_failure", failureCode: failure.failureCode });
        }
      }
    }
  } catch {
    notice = "error";
    observeVolunteerMutationFailure("volunteer.create_failure", "error");
  }

  revalidatePath("/admin/volunteers");
  redirect(`/admin/volunteers?notice=${notice}`);
}

async function updateVolunteerProfileAction(formData: FormData): Promise<VolunteerUpdateResult> {
  "use server";

  let notice: "unavailable" | "validation" | "error" | "updated" | "conflict" = "error";
  let savedVolunteer;
  try {
    const routeContext = await readVolunteerManagementRouteContext();
    const profileId = formData.get("profileId");
    if (!routeContext || !routeContext.canEdit || typeof profileId !== "string") {
      notice = "unavailable";
      observeVolunteerMutationFailure("volunteer.update_failure", "unavailable");
    } else {
      const normalizedProfileId = normalizeWorkspaceReference({ id: profileId }).value;
      const input = manualVolunteerInputFromFormData(formData);
      await updateVolunteerProfileManualFieldsWithClient(
        routeContext.supabase,
        normalizedProfileId,
        input,
        String(formData.get("expectedUpdatedAt") ?? ""),
      );
      savedVolunteer = await readVolunteerProfileWithClient(routeContext.supabase, routeContext.workspace.id, normalizedProfileId);
      notice = "updated";
    }
  } catch (error) {
    notice = error instanceof Error && error.message === "volunteer_edit_conflict" ? "conflict" : error instanceof Error && /invalid|is required|are required|too long|unsupported fields/i.test(error.message) ? "validation" : "error";
    observeVolunteerMutationFailure(
      "volunteer.update_failure",
      notice === "validation" ? "validation" : "error",
    );
  }

  if (notice !== "updated" || !savedVolunteer) return { kind: "rejected", reason: notice === "updated" ? "error" : notice };
  revalidatePath("/admin/volunteers");
  return { kind: "updated", volunteer: savedVolunteer };
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
    conflict: { title: "Profile changed", message: "This profile changed while you were editing it. Review the latest version." },
    deleted: {
      title: "Volunteer deleted",
      message: "This volunteer was removed from the project.",
    },
    validation: {
      title: "Check the volunteer details",
      message: "Name and at least one contact method are required, and fields must stay within the supported format.",
    },
    permission: {
      title: "Volunteer editing is unavailable",
      message: "Sign in again, then confirm your contact has permission to edit volunteers in this project.",
    },
    duplicate: {
      title: "Volunteer may already exist",
      message: "Search the volunteer directory before adding this person again.",
    },
    unavailable: {
      title: "Volunteer editing is unavailable",
      message: "Sign in again, then confirm your contact has permission to edit volunteers in this project.",
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
      key={state.workspaceKey}
      canEdit={state.canEdit}
      canCommunicate={state.canCommunicate}
      canViewSchedule={state.canViewSchedule}
      workspaceTimezone={state.workspaceTimezone}
      workspaceKey={state.workspaceKey}
      congregations={[
        ...new Set(
          state.profiles
            .map((profile) => profile.congregation)
            .filter((item): item is string => Boolean(item)),
        ),
      ].sort((a, b) => a.localeCompare(b))}
      createAction={createManualVolunteerAction}
      deleteAction={deleteVolunteerProfileAction}
      reviewDeletionAction={reviewVolunteerDeletionAction}
      updateAction={updateVolunteerProfileAction}
      readScheduleAction={readVolunteerScheduleAction}
      readProfileAction={readVolunteerProfileAction}
      volunteers={state.profiles}
    />
  );
}

export default async function AdminVolunteersPage({
  searchParams,
}: AdminVolunteersPageProps) {
  const state = await withReadTimeout(readVolunteerManagementRouteState(await searchParams));
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
    <AdminShell active="volunteers" workspaceName={isReadyState ? state.workspaceName : undefined} destinations={isReadyState ? state.navigationDestinations : ["overview"]} calendarWorkspaceKey={isReadyState ? state.workspaceKey : null}>
      <div className="mx-auto w-full min-w-0 max-w-[1280px]">
      <PageHeader title="Volunteers" secondaryActions={<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-[var(--pl-muted)]">
          {stats.map((stat) => (
            <span key={stat.label}>
              <strong className="mr-1 text-base font-bold text-[var(--pl-ink)]">{stat.value}</strong>
              {stat.label}{stat.label === "volunteer" && stat.value !== 1 ? "s" : ""}
            </span>
          ))}
        </div>} />    <Notice notice={state.notice} />

      <section className="mt-5">
        <VolunteerContent state={state} />
      </section>
      </div>
    </AdminShell>
  );
}
