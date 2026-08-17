import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { GlassCard } from "@/components/GlassCard";
import { TaskPresetManagement } from "@/components/TaskPresetManagement";
import {
  readTaskManagementRouteContext,
  readTaskManagementRouteState,
  type TaskManagementReadyRouteState,
  type TaskManagementRouteState,
} from "@/lib/tasks/routeRead.server";
import {
  archiveTaskPresetWithClient,
  createTaskPresetWithClient,
  readTaskPresetsWithClient,
  taskPresetCreateInputFromFormData,
} from "@/lib/tasks/server";
import { TaskPresetValidationError } from "@/lib/tasks/preset";
import { normalizeWorkspaceReference } from "@/lib/workspaces/identity";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type AdminTasksPageProps = Readonly<{
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>;

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeTasksRedirect(notice: string, selectedPresetId?: string) {
  const params = new URLSearchParams({ notice });
  if (selectedPresetId) params.set("preset", selectedPresetId);
  return `/admin/tasks?${params.toString()}`;
}

async function createTaskPresetAction(formData: FormData) {
  "use server";

  let notice: "created" | "validation" | "unavailable" | "error" = "error";
  let selectedPresetId: string | undefined;
  try {
    const context = await readTaskManagementRouteContext();
    if (!context || !context.canEdit) {
      notice = "unavailable";
    } else {
      const input = taskPresetCreateInputFromFormData(
        formData,
        context.workspace.id,
      );
      const result = await createTaskPresetWithClient(context.supabase, input);
      selectedPresetId = result.presetId;
      notice = "created";
    }
  } catch (error) {
    notice = error instanceof TaskPresetValidationError ? "validation" : "error";
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/admin/calendar");
  redirect(safeTasksRedirect(notice, selectedPresetId));
}

async function archiveTaskPresetAction(formData: FormData) {
  "use server";

  let notice: "archived" | "validation" | "unavailable" | "error" = "error";
  let selectedPresetId: string | undefined;
  try {
    const context = await readTaskManagementRouteContext();
    const submittedPresetId = formData.get("presetId");
    if (!context || !context.canEdit || typeof submittedPresetId !== "string") {
      notice = "unavailable";
    } else {
      const presetId = normalizeWorkspaceReference({ id: submittedPresetId }).value;
      const authorizedPresets = await readTaskPresetsWithClient(
        context.supabase,
        context.workspace.id,
      );
      const eligiblePreset = authorizedPresets.find(
        (preset) =>
          preset.id === presetId &&
          preset.lifecycle === "active" &&
          !preset.isSystemPreset,
      );
      if (!eligiblePreset) {
        notice = "unavailable";
      } else {
        await archiveTaskPresetWithClient(context.supabase, eligiblePreset.id);
        selectedPresetId = eligiblePreset.id;
        notice = "archived";
      }
    }
  } catch (error) {
    notice = error instanceof TaskPresetValidationError ? "validation" : "error";
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/admin/calendar");
  redirect(safeTasksRedirect(notice, selectedPresetId));
}

function isReadyState(
  state: TaskManagementRouteState,
): state is TaskManagementReadyRouteState {
  return state.kind === "ready_with_presets" || state.kind === "ready_empty";
}

export default async function AdminTasksPage({ searchParams }: AdminTasksPageProps) {
  const resolvedSearchParams = await searchParams;
  const state = await readTaskManagementRouteState(resolvedSearchParams);

  if (!isReadyState(state)) {
    return (
      <AdminShell active="tasks">
        <header className="border-b border-[var(--pl-border)] pb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pl-blue)]">
            Reusable work
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] text-[var(--pl-ink)] sm:text-4xl">
            Tasks
          </h1>
        </header>
        <GlassCard className="mt-5 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--pl-ink)]">{state.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--pl-text)]">
            {state.message}
          </p>
        </GlassCard>
      </AdminShell>
    );
  }

  return (
    <AdminShell active="tasks" workspaceName={state.workspaceName}>
      <TaskPresetManagement
        archiveAction={archiveTaskPresetAction}
        canEdit={state.canEdit}
        createAction={createTaskPresetAction}
        initialSelectedId={firstSearchParam(resolvedSearchParams?.preset)}
        notice={state.notice}
        presets={state.presets}
        workspaceName={state.workspaceName}
      />
    </AdminShell>
  );
}
