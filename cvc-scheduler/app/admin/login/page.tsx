import Link from "next/link";

import { AdminContactSignIn } from "@/components/AdminContactSignIn";
import { Button } from "@/components/Button";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import {
  getAdminAuthMode,
  isSupabaseAuthConfigured,
} from "@/lib/auth/config";
import { loadProjectContactGrants } from "@/lib/auth/project-contact-grants";
import { getSafeAdminRedirect } from "@/lib/auth/redirects";
import { readProjectContactSession } from "@/lib/auth/session";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
    signedOut?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  callback: "That sign-in link could not be confirmed. Request a new link and try again.",
  configuration: "Contact sign-in is not configured for this environment.",
  session: "The contact session could not be verified. Please sign in again.",
};

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const mode = getAdminAuthMode();
  const configured = isSupabaseAuthConfigured();
  const nextPath = getSafeAdminRedirect(params.next);
  const session = await readProjectContactSession();
  const grantState =
    session.status === "authenticated"
      ? await loadProjectContactGrants(session.userId)
      : null;
  const notice = params.error
    ? errorMessages[params.error] ?? "Sign-in could not be completed."
    : params.signedOut
      ? "You are signed out on this device."
      : null;

  return (
    <PageShell className="flex items-center justify-center">
      <GlassCard className="w-full max-w-sm p-6 sm:p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Project contact access
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
            Sign in
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            For invited main, assistant, and on-site project contacts. Volunteers do not
            need an account.
          </p>
        </div>

        {notice ? (
          <p className="mt-6 rounded-xl bg-slate-900/[0.05] px-4 py-3 text-sm leading-6 text-slate-700">
            {notice}
          </p>
        ) : null}

        {session.status === "authenticated" ? (
          <div className="mt-8 space-y-4">
            <div className="rounded-xl bg-white/60 px-4 py-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-950">Identity confirmed</p>
              <p className="mt-1 break-words">{session.email ?? "Invited project contact"}</p>
              <p className="mt-3 leading-6">{grantState?.reason}</p>
            </div>
            <Button className="w-full" href={nextPath}>
              Continue to prototype
            </Button>
            <form action="/admin/auth/sign-out" method="post">
              <Button className="w-full" type="submit" variant="secondary">
                Sign out
              </Button>
            </form>
          </div>
        ) : configured ? (
          <AdminContactSignIn nextPath={nextPath} />
        ) : (
          <div className="mt-8 space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              Contact sign-in needs Supabase environment values before it can send a
              link.
            </p>
            {mode === "review" ? (
              <Button className="w-full" href={nextPath}>
                Continue to prototype review
              </Button>
            ) : null}
          </div>
        )}

        {configured && mode === "review" && session.status !== "authenticated" ? (
          <Button className="mt-2 w-full" href={nextPath} variant="secondary">
            Continue to prototype review
          </Button>
        ) : null}

        <Link
          href="/"
          className="mt-6 block text-center text-sm font-medium text-slate-500 hover:text-slate-950"
        >
          Back to volunteer lookup
        </Link>
      </GlassCard>
    </PageShell>
  );
}
