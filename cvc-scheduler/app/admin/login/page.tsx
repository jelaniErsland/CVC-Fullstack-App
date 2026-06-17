import Link from "next/link";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";

export default function AdminLoginPage() {
  return (
    <PageShell className="flex items-center justify-center">
      <GlassCard className="w-full max-w-sm p-6 sm:p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Admin
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
            Sign in
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Access your project volunteer coordination workspace.
          </p>
        </div>

        <div className="mt-8 space-y-5">
          <Field id="email" label="Email" type="email" placeholder="admin@example.com" />
          <Field id="password" label="Password" type="password" placeholder="Password" />
          <Button href="/admin/dashboard" className="w-full">
            Sign in
          </Button>
        </div>

        <Link
          href="/"
          className="mt-6 block text-center text-sm font-medium text-slate-500 hover:text-slate-950"
        >
          Back to volunteer lookup
        </Link>

        <Link
          href="/admin/onboarding"
          className="mt-4 block text-center text-sm font-semibold text-slate-700 hover:text-slate-950"
        >
          Create project workspace
        </Link>
      </GlassCard>
    </PageShell>
  );
}
