import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  InitialAssignmentNotificationBoundaryError,
  sendInitialAssignmentNotificationsForItemWithClient,
} from "../lib/calendar/assignmentNotifications.server.ts";
import {
  createOperationalEvent,
  emitOperationalEvent,
  OPERATIONAL_EVENT_SCHEMA_VERSION,
} from "../lib/observability/server.ts";
import {
  detectStaleAssignmentDeliveries,
  observeStaleAssignmentDeliveries,
} from "../lib/observability/staleAssignmentDeliveries.server.ts";

const root = process.cwd();
const fixedNow = new Date("2026-08-10T18:30:00.000Z");
const calendarItemId = "11111111-1111-4111-8111-111111111111";
const deliveryId = "22222222-2222-4222-8222-222222222222";
const assignmentId = "33333333-3333-4333-8333-333333333333";
const volunteerProfileId = "44444444-4444-4444-8444-444444444444";
const tokenId = "55555555-5555-4555-8555-555555555555";
const bearer = "A".repeat(43);

const configuration = {
  ok: true,
  origin: "https://project-local.example.test",
  transport: "resend",
  from: "assignments@project-local.example.test",
  apiKey: "re_test_only_not_a_real_provider_key",
};

const claim = {
  delivery_id: deliveryId,
  calendar_assignment_id: assignmentId,
  volunteer_profile_id: volunteerProfileId,
  recipient_email: "alex.rivera@example.test",
  volunteer_display_name: "Alex Rivera",
  workspace_display_name: "Bozeman Local Project",
  workspace_timezone: "America/Denver",
  calendar_item_id: calendarItemId,
  task_title: "Gate Attendant",
  task_type: "general",
  start_date: "2026-08-18",
  start_time: "08:00:00",
  end_time: "12:00:00",
  schedule_notes: "Meet at the north entrance.",
  follow_up_contact_display_name: "Jordan Lee",
  follow_up_contact_email: "jordan.lee@example.test",
  follow_up_contact_phone: null,
  send_status: "sendable",
  attempt_count: 1,
  idempotency_key:
    "initial_assignment:initial-assignment.v1:33333333-3333-4333-8333-333333333333",
};

function notificationClient(options = {}) {
  return {
    async rpc(name) {
      if (name === "claim_initial_assignment_notification_deliveries") {
        return options.claimFailure
          ? { data: null, error: { code: "QA_CLAIM" } }
          : { data: [claim], error: null };
      }
      if (name === "issue_volunteer_schedule_access") {
        return options.scheduleAccessFailure
          ? { data: null, error: { code: "QA_ACCESS" } }
          : {
              data: [
                {
                  token_id: tokenId,
                  bearer_token: bearer,
                  token_expires_at: "2026-09-09T18:30:00.000Z",
                },
              ],
              error: null,
            };
      }
      if (name === "revoke_volunteer_schedule_access") {
        return options.revokeFailure
          ? { data: null, error: { code: "QA_REVOKE" } }
          : { data: tokenId, error: null };
      }
      if (name === "finalize_initial_assignment_notification_delivery") {
        return options.finalizationFailure
          ? { data: null, error: { code: "QA_FINALIZE" } }
          : { data: deliveryId, error: null };
      }
      throw new Error(`Unexpected regression RPC: ${name}`);
    },
  };
}

function captureRuntime(events) {
  return {
    now: () => fixedNow,
    write: (event) => events.push(event),
  };
}

function emailRuntime(status = 200) {
  return {
    fetch: async () =>
      new Response(JSON.stringify({ id: "resend-qa-message" }), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  };
}

async function readTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await readTree(target)));
    } else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) {
      files.push(target);
    }
  }
  return files;
}

async function main() {
  const captured = [];
  const event = createOperationalEvent(
    {
      event: "assignment_email.provider_failure",
      failureCode: "provider_send_failed",
      correlationId: deliveryId.toUpperCase(),
    },
    { now: () => fixedNow },
  );
  assert.deepEqual(event, {
    schemaVersion: OPERATIONAL_EVENT_SCHEMA_VERSION,
    event: "assignment_email.provider_failure",
    severity: "error",
    category: "assignment_email",
    stage: "provider",
    outcome: "failure",
    timestamp: fixedNow.toISOString(),
    failureCode: "provider_send_failed",
    correlationId: deliveryId,
  });
  assert.equal(
    emitOperationalEvent(
      { event: "assignment_email.sent", correlationId: deliveryId },
      captureRuntime(captured),
    ),
    true,
  );
  assert.equal(captured.length, 1);

  assert.equal(createOperationalEvent(new Error("secret provider response")), null);
  assert.equal(
    createOperationalEvent({
      event: "assignment_email.sent",
      recipientEmail: "alex.rivera@example.test",
    }),
    null,
  );
  assert.equal(
    createOperationalEvent({
      event: "assignment_email.provider_failure",
      failureCode: "https://example.test/private",
    }),
    null,
  );
  assert.equal(
    createOperationalEvent({
      event: "assignment_email.sent",
      correlationId: bearer,
    }),
    null,
  );
  assert.equal(
    emitOperationalEvent(
      { event: "assignment_email.sent", correlationId: deliveryId },
      {
        now: () => fixedNow,
        write: () => {
          throw new Error("simulated log sink failure");
        },
      },
    ),
    false,
  );

  const emailEvents = [];
  await assert.rejects(
    () =>
      sendInitialAssignmentNotificationsForItemWithClient(
        notificationClient(),
        { calendarItemId },
        { ok: false, reason: "transport_disabled" },
        { observability: captureRuntime(emailEvents) },
      ),
    (error) =>
      error instanceof InitialAssignmentNotificationBoundaryError &&
      error.safeStage === "configuration",
  );
  await assert.rejects(
    () =>
      sendInitialAssignmentNotificationsForItemWithClient(
        notificationClient({ claimFailure: true }),
        { calendarItemId },
        configuration,
        {
          email: emailRuntime(),
          observability: captureRuntime(emailEvents),
        },
      ),
    (error) =>
      error instanceof InitialAssignmentNotificationBoundaryError &&
      error.safeStage === "claim",
  );

  const scheduleFailure = await sendInitialAssignmentNotificationsForItemWithClient(
    notificationClient({ scheduleAccessFailure: true }),
    { calendarItemId },
    configuration,
    {
      email: emailRuntime(),
      observability: captureRuntime(emailEvents),
    },
  );
  assert.equal(scheduleFailure.scheduleAccessFailureCount, 1);

  const providerFailure = await sendInitialAssignmentNotificationsForItemWithClient(
    notificationClient(),
    { calendarItemId },
    configuration,
    {
      email: emailRuntime(503),
      observability: captureRuntime(emailEvents),
    },
  );
  assert.equal(providerFailure.providerFailureCount, 1);

  const finalizationFailure =
    await sendInitialAssignmentNotificationsForItemWithClient(
      notificationClient({ finalizationFailure: true }),
      { calendarItemId },
      configuration,
      {
        email: emailRuntime(),
        observability: captureRuntime(emailEvents),
      },
    );
  assert.equal(finalizationFailure.finalizationFailureCount, 1);

  const sent = await sendInitialAssignmentNotificationsForItemWithClient(
    notificationClient(),
    { calendarItemId },
    configuration,
    {
      email: emailRuntime(),
      observability: captureRuntime(emailEvents),
    },
  );
  assert.equal(sent.sentCount, 1);

  const sinkFailureDidNotChangeDelivery =
    await sendInitialAssignmentNotificationsForItemWithClient(
      notificationClient(),
      { calendarItemId },
      configuration,
      {
        email: emailRuntime(),
        observability: {
          now: () => fixedNow,
          write: () => {
            throw new Error("simulated log sink failure");
          },
        },
      },
    );
  assert.equal(sinkFailureDidNotChangeDelivery.sentCount, 1);

  const emittedNames = new Set(emailEvents.map((item) => item.event));
  assert.ok(emittedNames.has("assignment_email.configuration_failure"));
  assert.ok(emittedNames.has("assignment_email.claim_failure"));
  assert.ok(emittedNames.has("assignment_email.schedule_access_failure"));
  assert.ok(emittedNames.has("assignment_email.provider_failure"));
  assert.ok(emittedNames.has("assignment_email.finalization_failure"));
  assert.ok(emittedNames.has("assignment_email.sent"));
  const serializedEmailEvents = JSON.stringify(emailEvents).toLowerCase();
  for (const forbidden of [
    "alex",
    "jordan",
    "example.test",
    bearer.toLowerCase(),
    configuration.apiKey.toLowerCase(),
    "qa_claim",
    "qa_access",
    "qa_finalize",
  ]) {
    assert.equal(serializedEmailEvents.includes(forbidden), false);
  }

  const candidates = [
    {
      deliveryId,
      deliveryState: "sending",
      sendingExpiresAt: "2026-08-10T18:29:59.000Z",
    },
    {
      deliveryId: "66666666-6666-4666-8666-666666666666",
      deliveryState: "sending",
      sendingExpiresAt: "2026-08-10T18:30:01.000Z",
    },
    {
      deliveryId: "77777777-7777-4777-8777-777777777777",
      deliveryState: "failed",
      sendingExpiresAt: "2026-08-10T18:00:00.000Z",
    },
    {
      deliveryId: "88888888-8888-4888-8888-888888888888",
      deliveryState: "sending",
      sendingExpiresAt: "2026-08-10T18:00:00.000Z",
      recipientEmail: "must-not-be-accepted@example.test",
    },
  ];
  const candidatesBefore = structuredClone(candidates);
  assert.deepEqual(detectStaleAssignmentDeliveries(candidates, { now: () => fixedNow }), [
    {
      deliveryId,
      sendingExpiresAt: "2026-08-10T18:29:59.000Z",
    },
  ]);
  const staleEvents = [];
  const stale = observeStaleAssignmentDeliveries(candidates, {
    now: () => fixedNow,
    observability: captureRuntime(staleEvents),
  });
  assert.equal(stale.length, 1);
  assert.equal(staleEvents[0].event, "assignment_email.stale_delivery_detected");
  assert.deepEqual(candidates, candidatesBefore);

  const expectedEmailStages = {
    "assignment_email.configuration_failure": ["transport_disabled", "configuration"],
    "assignment_email.claim_failure": ["claim_unavailable", "claim"],
    "assignment_email.schedule_access_failure": ["issue_failed", "schedule_access"],
    "assignment_email.provider_failure": ["provider_send_failed", "provider"],
    "assignment_email.finalization_failure": ["finalize_unavailable", "finalize"],
  };
  for (const [eventName, [failureCode, stage]] of Object.entries(expectedEmailStages)) {
    assert.equal(
      createOperationalEvent(
        { event: eventName, failureCode },
        { now: () => fixedNow },
      )?.stage,
      stage,
    );
  }
  assert.equal(
    createOperationalEvent(
      { event: "assignment_email.sent" },
      { now: () => fixedNow },
    )?.stage,
    "finalize",
  );

  const staleSource = await readFile(
    path.join(root, "lib/observability/staleAssignmentDeliveries.server.ts"),
    "utf8",
  );
  assert.match(staleSource, /^import "server-only";/);
  for (const forbidden of [
    /createServerSupabaseClient/,
    /service_role/i,
    /\.rpc\s*\(/,
    /\.from\s*\(/,
    /\bfetch\s*\(/,
    /retry/i,
  ]) {
    assert.doesNotMatch(staleSource, forbidden);
  }

  const sourceExpectations = [
    ["app/admin/auth/callback/route.ts", "auth.callback_failure"],
    ["app/admin/calendar/page.tsx", "calendar.create_failure"],
    ["app/admin/calendar/page.tsx", "calendar.update_failure"],
    ["app/admin/calendar/page.tsx", "calendar.publish_failure"],
    ["app/admin/calendar/page.tsx", "assignment.create_failure"],
    ["app/admin/calendar/page.tsx", "assignment.cancel_failure"],
    ["app/admin/volunteers/page.tsx", "volunteer.create_failure"],
    ["app/admin/volunteers/page.tsx", "volunteer.update_failure"],
    ["app/v/access/[token]/route.ts", "schedule_access.exchange_failure"],
    ["app/v/schedule/actions.ts", "volunteer_response.submit_failure"],
    ["app/v/schedule/actions.ts", "volunteer_response.confirm_all_failure"],
  ];
  for (const [relativePath, expected] of sourceExpectations) {
    const source = await readFile(path.join(root, relativePath), "utf8");
    assert.match(source, new RegExp(expected.replace(".", "\\.")));
  }

  const clientSources = [
    ...(await readTree(path.join(root, "app"))),
    ...(await readTree(path.join(root, "components"))),
  ];
  for (const sourcePath of clientSources) {
    const source = await readFile(sourcePath, "utf8");
    if (/^[\s\uFEFF]*["']use client["'];/m.test(source)) {
      assert.doesNotMatch(source, /lib\/observability\/server/);
    }
  }

  console.log("Production observability regression checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
