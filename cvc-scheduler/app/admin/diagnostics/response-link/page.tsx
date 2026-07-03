import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Link2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/Button";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { readProjectContactSession } from "@/lib/auth/session";
import { readResponseLinkDiagnosticConfiguration } from "@/lib/responseTokens/diagnostic.server";
import { issueResponseLinkDiagnosticAction } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Response link diagnostic | Project Local",
  description: "Developer-only response-link issuance diagnostic.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type DiagnosticPageProps = Readonly<{
  searchParams: Promise<{
    result?: string | string[];
    assignment?: string | string[];
    expires?: string | string[];
  }>;
}>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

function formatExpiration(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZoneName: "short",
  }).format(new Date(value));
}

function DiagnosticNotice({
  title,
  message,
}: Readonly<{ title: string; message: string }>) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <div className="flex items-start gap-3">
        <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-6 text-amber-900">{message}</p>
        </div>
      </div>
    </div>
  );
}

export default async function ResponseLinkDiagnosticPage({
  searchParams,
}: DiagnosticPageProps) {
  const [session, params] = await Promise.all([
    readProjectContactSession(),
    searchParams,
  ]);
  const configuration = readResponseLinkDiagnosticConfiguration();
  const result = one(params.result);
  const submittedAssignment = one(params.assignment);
  const assignmentId =
    submittedAssignment && uuidPattern.test(submittedAssignment)
      ? submittedAssignment.toLowerCase()
      : null;
  const expiresAt = formatExpiration(one(params.expires));

  return (
    <PageShell className="px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <header className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-sky-100 text-sky-800">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">Project Local diagnostics</p>
            <p className="text-xs text-slate-500">Authenticated project-contact QA only</p>
          </div>
        </header>

        <GlassCard className="mt-7 overflow-hidden">
          <div className="border-b border-slate-200/70 p-6 sm:p-8">
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-700">
              <Link2 aria-hidden="true" className="size-4" />
              Diagnostic preview
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
              Response link issuance
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              This unlinked tool exercises authorized issuance for one assignment. It does not display the credential, send email, or deliver a reminder.
            </p>
          </div>

          <div className="space-y-5 p-6 sm:p-8">
            {session.status === "unconfigured" || session.status === "unavailable" ? (
              <DiagnosticNotice
                title="Contact authentication is unavailable"
                message="Configure the public Supabase environment and try again. No response link was issued."
              />
            ) : session.status === "anonymous" ? (
              <div className="space-y-4">
                <DiagnosticNotice
                  title="Project-contact sign-in required"
                  message="A verified contact session is required even when the rest of the mock admin is in review mode."
                />
                <Button
                  href="/admin/login?next=%2Fadmin%2Fdiagnostics%2Fresponse-link"
                  className="w-full sm:w-auto"
                >
                  Sign in as a project contact
                </Button>
              </div>
            ) : configuration.status !== "configured" ? (
              <DiagnosticNotice
                title="Response-link origin is not configured"
                message="Set the trusted server-side RESPONSE_LINK_BASE_URL before using this diagnostic. No response link was issued."
              />
            ) : (
              <>
                {result === "issued" && assignmentId && expiresAt ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 aria-hidden="true" className="size-5" />
                      Diagnostic issuance succeeded
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm">
                      <div>
                        <dt className="font-medium text-emerald-800">Assignment</dt>
                        <dd className="mt-1 break-all font-mono text-xs">{assignmentId}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-emerald-800">Redacted response path</dt>
                        <dd className="mt-1 font-mono text-xs">/respond/[redacted]</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-emerald-800">Expires</dt>
                        <dd className="mt-1">{expiresAt}</dd>
                      </div>
                    </dl>
                    <p className="mt-4 text-sm leading-6 text-emerald-900">
                      The full credential was discarded by this diagnostic response and nothing was sent.
                    </p>
                  </div>
                ) : null}

                {result === "invalid" ? (
                  <DiagnosticNotice
                    title="Check the diagnostic input"
                    message="Use one assignment UUID and the fixed one-hour diagnostic TTL. No response link was issued."
                  />
                ) : null}
                {result === "unavailable" ? (
                  <DiagnosticNotice
                    title="Issuance was not authorized or available"
                    message="Confirm the assignment is active and this contact has assignments.edit, then try again. No internal details are exposed."
                  />
                ) : null}
                {result === "configuration" || result === "error" ? (
                  <DiagnosticNotice
                    title="Diagnostic issuance is unavailable"
                    message="Check the server configuration and try again. No response link was issued."
                  />
                ) : null}

                <form action={issueResponseLinkDiagnosticAction} className="space-y-5">
                  <div>
                    <label htmlFor="assignmentId" className="text-sm font-semibold text-slate-800">
                      Assignment ID
                    </label>
                    <input
                      id="assignmentId"
                      name="assignmentId"
                      required
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="00000000-0000-0000-0000-000000000000"
                      className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-mono text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="expiresInHours" className="text-sm font-semibold text-slate-800">
                      Expires in hours
                    </label>
                    <input
                      id="expiresInHours"
                      name="expiresInHours"
                      type="number"
                      min={1}
                      max={1}
                      step={1}
                      defaultValue={1}
                      required
                      readOnly
                      className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                  <Button type="submit">Generate redacted diagnostic preview</Button>
                </form>
              </>
            )}
          </div>
        </GlassCard>

        <p className="mt-5 text-center text-xs leading-5 text-slate-400">
          Unlinked developer/admin QA surface. No delivery, lookup, remembered-device access, or product-route integration.
        </p>
        <Link
          href="/admin/login"
          className="mt-3 block text-center text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          Contact access
        </Link>
      </div>
    </PageShell>
  );
}
