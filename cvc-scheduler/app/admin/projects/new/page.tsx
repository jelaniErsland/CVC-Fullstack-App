import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { CreateProjectWizard } from "@/components/CreateProjectWizard";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";

export default function AdminNewProjectPage() {
  return (
    <PageShell>
      <div className="mx-auto grid min-h-[calc(100vh-40px)] w-full max-w-7xl gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="lg:py-4">
          <GlassCard className="p-4 lg:sticky lg:top-6">
            <Link href="/" className="block text-lg font-semibold tracking-tight text-slate-950">
              CVC Scheduler
            </Link>
            <AdminNav active="projects" />
          </GlassCard>
        </aside>

        <main className="py-4">
          <CreateProjectWizard />
        </main>
      </div>
    </PageShell>
  );
}
