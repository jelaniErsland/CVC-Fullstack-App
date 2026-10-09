import { AdminShell } from "@/components/AdminShell";
import { NeedsAttentionInbox } from "@/components/NeedsAttentionInbox";
import { GlassCard } from "@/components/GlassCard";
import { readNeedsAttentionRouteState } from "@/lib/needsAttention/routeRead.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AdminNeedsAttentionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [state, params] = await Promise.all([readNeedsAttentionRouteState(), searchParams]);
  if (state.kind !== "ready") return <AdminShell active="needs-attention">
    <h1 className="text-3xl font-bold text-[var(--pl-ink)]">Needs Attention</h1>
    <GlassCard className="mt-5 p-5"><h2 className="font-semibold">{state.title}</h2><p className="mt-2 text-sm">{state.message}</p></GlassCard>
  </AdminShell>;
  return <AdminShell active="needs-attention" workspaceName={state.workspaceName} destinations={state.navigationDestinations}>
    <NeedsAttentionInbox state={state} initialFilters={{
      support: typeof params.support === "string" ? params.support : undefined,
      category: typeof params.category === "string" ? params.category : undefined,
      horizon: typeof params.horizon === "string" ? params.horizon : undefined,
    }} />
  </AdminShell>;
}
