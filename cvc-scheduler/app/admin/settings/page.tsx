import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { ProjectSettingsPanel } from "@/components/ProjectSettingsPanel";
import { getAssignedProjectWorkspace } from "@/lib/mockData";

export default function AdminSettingsPage() {
  const workspace = getAssignedProjectWorkspace();

  if (!workspace.project) {
    return null;
  }

  return (
    <PageShell>
      <div className="mx-auto grid min-h-[calc(100vh-40px)] w-full max-w-7xl gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="lg:py-4">
          <GlassCard className="p-4 lg:sticky lg:top-6">
            <Link href="/" className="block text-lg font-semibold tracking-tight text-slate-950">
              CVC Scheduler
            </Link>
            <AdminNav active="settings" />
          </GlassCard>
        </aside>

        <main className="py-4">
          <ProjectSettingsPanel
            project={workspace.project}
            contacts={workspace.contacts}
          />
        </main>
      </div>
    </PageShell>
  );
}
