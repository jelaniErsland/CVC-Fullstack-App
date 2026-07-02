import type { Metadata } from "next";
import {
  CalendarDays,
  Check,
  Clock3,
  Info,
  ShieldCheck,
  X,
} from "lucide-react";

import { PageShell } from "@/components/PageShell";
import { loadPublicAssignmentResponseRoute } from "@/lib/responseTokens/publicRoute";
import type {
  PublicAssignmentResponseContext,
  PublicAssignmentResponseStatus,
} from "@/lib/responseTokens/token";
import { submitPublicAssignmentResponseAction } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Respond to an assignment | Project Local",
  description: "Confirm or decline one Project Local volunteer assignment.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type PageProps = Readonly<{
  params: Promise<{ token: string }>;
  searchParams: Promise<{ outcome?: string | string[] }>;
}>;

type PageOutcome =
  | PublicAssignmentResponseStatus
  | "changed"
  | "unavailable"
  | "configuration_unavailable"
  | "error"
  | null;

const statusLabels: Record<
  PublicAssignmentResponseContext["currentResponseStatus"],
  string
> = {
  needs_response: "Needs your response",
  confirmed: "Confirmed",
  declined: "Can’t make it",
};

const scheduleKindLabels: Record<PublicAssignmentResponseContext["scheduleKind"], string> = {
  timed: "Scheduled time",
  date_based: "Date-based assignment",
  multi_day_window: "Project window",
  milestone: "Project milestone",
};

function parseOutcome(value: string | string[] | undefined): PageOutcome {
  if (Array.isArray(value)) return null;
  if (
    value === "confirmed" ||
    value === "declined" ||
    value === "changed" ||
    value === "unavailable" ||
    value === "configuration_unavailable" ||
    value === "error"
  ) {
    return value;
  }
  return null;
}

function formatDate(value: string) {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return value;
  const [year, month, day] = parts;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatTime(value: string | null) {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return value;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 0, 1, hour, minute)));
}

function StateCard({
  eyebrow,
  title,
  message,
}: Readonly<{ eyebrow: string; title: string; message: string }>) {
  return (
    <PageShell className="flex items-center justify-center px-5 py-12">
      <article className="w-full max-w-xl rounded-[1.75rem] border border-white/80 bg-white/78 p-7 shadow-[0_28px_90px_rgba(15,23,42,0.11)] backdrop-blur-2xl sm:p-10">
        <div className="flex size-11 items-center justify-center rounded-full bg-sky-100 text-sky-800">
          <Info aria-hidden="true" className="size-5" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950">
          {title}
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">{message}</p>
        <p className="mt-6 text-sm leading-6 text-slate-500">
          No account or password is needed to use an active assignment link.
        </p>
      </article>
    </PageShell>
  );
}

export default async function PublicAssignmentResponsePage({
  params,
  searchParams,
}: PageProps) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const routeState = await loadPublicAssignmentResponseRoute(token);

  if (routeState.kind === "configuration_unavailable") {
    return (
      <StateCard
        eyebrow="Assignment response"
        title="Response links are temporarily unavailable"
        message="This environment is not configured for assignment responses yet. Please contact the project team if you need help."
      />
    );
  }

  if (routeState.kind === "unavailable") {
    return (
      <StateCard
        eyebrow="Assignment response"
        title="This link is expired or unavailable"
        message="The link may no longer be active. Please contact the project team for a current assignment link."
      />
    );
  }

  if (routeState.kind === "error") {
    return (
      <StateCard
        eyebrow="Assignment response"
        title="We couldn’t load this assignment"
        message="Please try again shortly. If the problem continues, contact the project team."
      />
    );
  }

  const { context } = routeState;
  const outcome = parseOutcome(query.outcome);
  const successfulOutcome =
    (outcome === "confirmed" || outcome === "declined") &&
    context.currentResponseStatus === outcome
      ? outcome
      : null;
  async function submitAction(formData: FormData) {
    "use server";
    await submitPublicAssignmentResponseAction(token, formData);
  }
  const startTime = formatTime(context.startTime);
  const endTime = formatTime(context.endTime);
  const timeLabel = startTime
    ? `${startTime}${endTime ? `–${endTime}` : ""}`
    : "No specific time";
  const dateLabel = context.endDate
    ? `${formatDate(context.startDate)} – ${formatDate(context.endDate)}`
    : formatDate(context.startDate);

  return (
    <PageShell className="px-5 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-sky-100 text-sky-800">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">Project Local</p>
            <p className="text-xs text-slate-500">Secure assignment response</p>
          </div>
        </header>

        <article className="mt-7 overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/78 shadow-[0_28px_90px_rgba(15,23,42,0.11)] backdrop-blur-2xl">
          <header className="p-6 sm:p-9">
            <p className="text-sm font-semibold text-sky-700">{context.workspaceDisplayName}</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl">
              {context.taskTitle}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Confirm whether you can help with this assignment. No account or password is needed.
            </p>
          </header>

          <dl className="grid border-y border-slate-200/70 sm:grid-cols-2">
            <div className="flex gap-3 border-b border-slate-200/70 p-5 sm:border-b-0 sm:border-r sm:p-6">
              <CalendarDays aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-sky-700" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {scheduleKindLabels[context.scheduleKind]}
                </dt>
                <dd className="mt-1 text-sm leading-6 text-slate-800">{dateLabel}</dd>
              </div>
            </div>
            <div className="flex gap-3 p-5 sm:p-6">
              <Clock3 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-sky-700" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Time
                </dt>
                <dd className="mt-1 text-sm leading-6 text-slate-800">
                  {timeLabel}
                  <br />
                  <span className="text-slate-500">{context.timezone}</span>
                </dd>
              </div>
            </div>
          </dl>

          <section className="p-6 sm:p-9" aria-labelledby="response-heading">
            {successfulOutcome ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                <div className="flex items-center gap-2 font-semibold">
                  <Check aria-hidden="true" className="size-5" />
                  Response saved
                </div>
                <p className="mt-2 text-sm leading-6 text-emerald-800">
                  Your response is now {successfulOutcome === "confirmed" ? "Confirmed" : "Can’t make it"}.
                </p>
              </div>
            ) : null}

            {outcome === "changed" ? (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                <p className="font-semibold">This response changed.</p>
                <p className="mt-1 text-sm leading-6">Refresh the page and try again using the latest response.</p>
              </div>
            ) : null}

            {outcome === "error" ? (
              <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
                <p className="font-semibold">We couldn’t save that response.</p>
                <p className="mt-1 text-sm leading-6">Please try again shortly.</p>
              </div>
            ) : null}

            {outcome === "unavailable" ? (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                <p className="font-semibold">That response is no longer available.</p>
                <p className="mt-1 text-sm leading-6">Refresh the page or contact the project team for a current link.</p>
              </div>
            ) : null}

            <div className={successfulOutcome ? "mt-7" : ""}>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Current response
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-950">
                {statusLabels[context.currentResponseStatus]}
              </p>
            </div>

            <form action={submitAction} className="mt-7">
              <h2 id="response-heading" className="text-xl font-semibold tracking-tight text-slate-950">
                Can you make it?
              </h2>
              <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="response-note">
                Note <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="response-note"
                name="note"
                maxLength={1000}
                rows={3}
                className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                placeholder="Add a brief note for the project team"
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="submit"
                  name="response"
                  value="confirmed"
                  disabled={context.currentResponseStatus === "confirmed"}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-emerald-200"
                >
                  <Check aria-hidden="true" className="size-4" />
                  {context.currentResponseStatus === "confirmed" ? "Confirmed" : "Confirm"}
                </button>
                <button
                  type="submit"
                  name="response"
                  value="declined"
                  disabled={context.currentResponseStatus === "declined"}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <X aria-hidden="true" className="size-4" />
                  Can’t make it
                </button>
              </div>
            </form>
          </section>
        </article>

        <p className="mt-5 text-center text-xs leading-5 text-slate-400">
          This page is limited to one assignment response. It does not provide access to a volunteer schedule or account.
        </p>
      </div>
    </PageShell>
  );
}
