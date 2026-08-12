import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/Button";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { readProjectContactSession } from "@/lib/auth/session";
import { readCalendarAssignmentMutationRouteContext } from "@/lib/calendar/routeRead.server";
import {
  readAssignmentNotificationHealthWithClient,
  type AssignmentNotificationHealthResult,
} from "@/lib/observability/assignmentNotificationHealth.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Notification health | Project Local",
  description: "Authenticated assignment-email delivery health check.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function Notice({
  title,
  message,
}: Readonly<{ title: string; message: string }>) {
  return (
    <div className="rounded-[var(--pl-radius-control)] border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-6 text-amber-900">{message}</p>
        </div>
      </div>
    </div>
  );
}

function HealthResult({
  result,
}: Readonly<{ result: AssignmentNotificationHealthResult }>) {
  if (result.kind === "healthy") {
    return (
      <div className="rounded-[var(--pl-radius-control)] border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
        <div className="flex items-center gap-2 font-semibold">
          <CheckCircle2 aria-hidden="true" className="size-5" />
          No stale assignment email deliveries need attention.
        </div>
        <p className="mt-2 text-sm leading-6 text-emerald-900">
          The authorized workspace has no expired sending lease in the bounded operational check.
        </p>
      </div>
    );
  }

  if (result.kind === "attention") {
    const countLabel =
      result.atReadLimit && result.staleDeliveryCount === 100
        ? "100 or more"
        : String(result.staleDeliveryCount);
    return (
      <div className="rounded-[var(--pl-radius-control)] border border-amber-300 bg-amber-50 p-5 text-amber-950">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle aria-hidden="true" className="size-5" />
          {countLabel} stale assignment email {result.staleDeliveryCount === 1 ? "delivery" : "deliveries"} need review.
        </div>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          Investigate the authoritative delivery ledger before any manual retry. Do not blindly resend.
        </p>
      </div>
    );
  }

  return (
    <Notice
      title="Notification health is unavailable"
      message="This check requires one active authorized workspace and assignment-email operating authority. No delivery state was changed."
    />
  );
}

export default async function NotificationHealthPage() {
  const session = await readProjectContactSession();
  let health: AssignmentNotificationHealthResult | null = null;

  if (session.status === "authenticated") {
    const context = await readCalendarAssignmentMutationRouteContext();
    health = context
      ? await readAssignmentNotificationHealthWithClient(context.supabase)
      : { kind: "unavailable" };
  }

  return (
    <PageShell className="bg-[var(--pl-background)] px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <header className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-[var(--pl-radius-control)] bg-[var(--pl-blue-soft)] text-[var(--pl-blue-deep)]">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--pl-ink)]">Project Local diagnostics</p>
            <p className="text-xs text-[var(--pl-muted)]">Authenticated operator check</p>
          </div>
        </header>

        <GlassCard className="mt-7 overflow-hidden">
          <div className="border-b border-[var(--pl-border)] p-6 sm:p-8">
            <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[var(--pl-ink)] sm:text-4xl">
              Assignment email delivery health
            </h1>
            <p className="mt-4 text-sm leading-6 text-[var(--pl-muted)]">
              This unlinked read-only check looks only for expired assignment-email sending leases in one authorized workspace. It does not retry, finalize, or send anything.
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {session.status === "anonymous" ? (
              <div className="space-y-4">
                <Notice
                  title="Project-contact sign-in required"
                  message="A verified Project Local contact session is required for this operator check."
                />
                <Button
                  href="/admin/login?next=%2Fadmin%2Fdiagnostics%2Fnotification-health"
                  className="w-full sm:w-auto"
                >
                  Sign in as a project contact
                </Button>
              </div>
            ) : session.status === "unconfigured" || session.status === "unavailable" ? (
              <Notice
                title="Contact authentication is unavailable"
                message="The authenticated operator check cannot run. No delivery state was changed."
              />
            ) : health ? (
              <HealthResult result={health} />
            ) : null}
          </div>
        </GlassCard>

        <p className="mt-5 text-center text-xs leading-5 text-[var(--pl-muted)]">
          Unlinked operator-only surface. No recipient, volunteer, provider, credential, URL, or raw delivery row is displayed.
        </p>
      </div>
    </PageShell>
  );
}
