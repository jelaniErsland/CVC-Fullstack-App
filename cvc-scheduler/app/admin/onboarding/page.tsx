import Link from "next/link";
import { CreateProjectWizard } from "@/components/CreateProjectWizard";
import { PageShell } from "@/components/PageShell";

export default function AdminOnboardingPage() {
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-6xl py-4">
        <header className="mb-5 flex items-center justify-between">
          <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-950">
            CVC Scheduler
          </Link>
          <Link
            href="/admin/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/58 hover:text-slate-950"
          >
            Back to login
          </Link>
        </header>

        <CreateProjectWizard />
      </div>
    </PageShell>
  );
}
