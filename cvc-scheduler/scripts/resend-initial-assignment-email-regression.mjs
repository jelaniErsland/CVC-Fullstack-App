import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  InitialAssignmentNotificationBoundaryError,
  sendInitialAssignmentNotificationsForItemWithClient,
} from "../lib/calendar/assignmentNotifications.server.ts";
import {
  buildResendInitialAssignmentIdempotencyKey,
  INITIAL_ASSIGNMENT_EMAIL_TEMPLATE_VERSION,
  readInitialAssignmentEmailConfiguration,
  sendInitialAssignmentEmail,
} from "../lib/notifications/initialAssignmentEmail.server.ts";

const root = process.cwd();
const apiKey = "re_qa_only_not_a_real_resend_key";
const bearer = "A".repeat(43);
const scheduleAccessUrl = `https://project-local.example.test/v/access/${bearer}`;
const input = {
  deliveryId: "11111111-1111-4111-8111-111111111111",
  assignmentId: "22222222-2222-4222-8222-222222222222",
  idempotencyKey:
    "initial_assignment:initial-assignment.v1:22222222-2222-4222-8222-222222222222",
  recipientEmail: "alex.rivera@example.test",
  volunteerDisplayName: "Alex Rivera",
  workspaceDisplayName: "Bozeman Local Project",
  taskTitle: "Gate & Welcome",
  taskType: "general",
  scheduleDate: "2026-08-18",
  scheduleStartTime: "08:00:00",
  scheduleEndTime: "12:00:00",
  scheduleNotes: "Meet at the north entrance.",
  followUpContact: {
    displayName: "Jordan Lee",
    email: "jordan.lee@example.test",
    phone: "+1 406 555 0100",
  },
  scheduleAccessUrl,
  tokenExpiresAt: "2026-09-17T14:00:00.000Z",
  templateVersion: INITIAL_ASSIGNMENT_EMAIL_TEMPLATE_VERSION,
};

function resendEnvironment(overrides = {}) {
  return {
    ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT: "resend",
    ASSIGNMENT_NOTIFICATION_BASE_URL: "https://project-local.example.test",
    ASSIGNMENT_NOTIFICATION_FROM: "assignments@project-local.example.test",
    RESEND_API_KEY: apiKey,
    ...overrides,
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function main() {
  assert.deepEqual(readInitialAssignmentEmailConfiguration({}), {
    ok: false,
    reason: "transport_disabled",
  });
  assert.deepEqual(
    readInitialAssignmentEmailConfiguration({
      ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT: "disabled",
    }),
    { ok: false, reason: "transport_disabled" },
  );
  assert.deepEqual(
    readInitialAssignmentEmailConfiguration({
      ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT: "smtp",
    }),
    { ok: false, reason: "transport_unsupported" },
  );
  assert.deepEqual(
    readInitialAssignmentEmailConfiguration(
      resendEnvironment({ ASSIGNMENT_NOTIFICATION_BASE_URL: "" }),
    ),
    { ok: false, reason: "origin_unavailable" },
  );
  assert.deepEqual(
    readInitialAssignmentEmailConfiguration(
      resendEnvironment({
        ASSIGNMENT_NOTIFICATION_BASE_URL: "http://127.0.0.1:3000",
      }),
    ),
    { ok: false, reason: "origin_unavailable" },
  );
  assert.deepEqual(
    readInitialAssignmentEmailConfiguration(
      resendEnvironment({ ASSIGNMENT_NOTIFICATION_FROM: "not-an-email" }),
    ),
    { ok: false, reason: "from_unavailable" },
  );
  assert.deepEqual(
    readInitialAssignmentEmailConfiguration(resendEnvironment({ RESEND_API_KEY: "" })),
    { ok: false, reason: "resend_api_key_unavailable" },
  );
  assert.deepEqual(
    readInitialAssignmentEmailConfiguration(
      resendEnvironment({ RESEND_API_KEY: "invalid key with spaces" }),
    ),
    { ok: false, reason: "resend_api_key_unavailable" },
  );

  const resendConfiguration = readInitialAssignmentEmailConfiguration(
    resendEnvironment(),
  );
  assert(resendConfiguration.ok && resendConfiguration.transport === "resend");

  await assert.rejects(
    sendInitialAssignmentNotificationsForItemWithClient(
      { rpc: async () => ({ data: null, error: { message: "not surfaced" } }) },
      { calendarItemId: input.assignmentId },
      resendConfiguration,
    ),
    (error) =>
      error instanceof InitialAssignmentNotificationBoundaryError &&
      error.safeStage === "claim" &&
      !error.message.includes("not surfaced"),
  );
  await assert.rejects(
    sendInitialAssignmentNotificationsForItemWithClient(
      { rpc: async () => assert.fail("Disabled configuration must fail before claim.") },
      { calendarItemId: input.assignmentId },
      readInitialAssignmentEmailConfiguration({}),
    ),
    (error) =>
      error instanceof InitialAssignmentNotificationBoundaryError &&
      error.safeStage === "configuration",
  );

  const providerRequests = [];
  const success = await sendInitialAssignmentEmail(resendConfiguration, input, {
    fetch: async (url, init) => {
      providerRequests.push({ url, init });
      return jsonResponse({ id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" });
    },
  });
  assert.deepEqual(success, {
    ok: true,
    providerMessageId: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794",
  });
  assert.equal(providerRequests.length, 1);
  const request = providerRequests[0];
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.redirect, "error");
  assert.equal(request.init.headers.Authorization, `Bearer ${apiKey}`);
  assert.equal(request.init.headers["Content-Type"], "application/json");

  const providerIdempotencyKey = buildResendInitialAssignmentIdempotencyKey(input);
  assert.equal(request.init.headers["Idempotency-Key"], providerIdempotencyKey);
  assert.equal(providerIdempotencyKey, buildResendInitialAssignmentIdempotencyKey(input));
  assert(providerIdempotencyKey.length <= 256);
  for (const sensitiveValue of [apiKey, input.recipientEmail, bearer, scheduleAccessUrl]) {
    assert(!providerIdempotencyKey.includes(sensitiveValue));
  }

  const body = JSON.parse(request.init.body);
  assert.equal(body.from, "assignments@project-local.example.test");
  assert.deepEqual(body.to, [input.recipientEmail]);
  assert.match(body.subject, /Project Local assignment/);
  assert.match(body.subject, /Bozeman Local Project/);
  assert.match(body.text, /Alex Rivera/);
  assert.match(body.text, /Gate & Welcome/);
  assert.match(body.text, /Jordan Lee/);
  assert.match(body.text, /jordan\.lee@example\.test/);
  assert(body.text.includes(scheduleAccessUrl));
  assert(body.html.includes(scheduleAccessUrl));
  assert.match(body.html, /Gate &amp; Welcome/);
  assert(!request.init.body.includes(apiKey));
  assert(!JSON.stringify(success).includes(apiKey));
  assert(!JSON.stringify(success).includes(scheduleAccessUrl));
  assert(!JSON.stringify(success).includes(bearer));

  const malformedId = await sendInitialAssignmentEmail(resendConfiguration, input, {
    fetch: async () => jsonResponse({ id: "unsafe provider id with spaces" }),
  });
  assert.deepEqual(malformedId, {
    ok: false,
    safeFailureCode: "provider_send_failed",
  });

  const providerBodySentinel = "raw-provider-body-must-not-leak";
  const nonSuccess = await sendInitialAssignmentEmail(resendConfiguration, input, {
    fetch: async () => jsonResponse({ error: providerBodySentinel }, 422),
  });
  assert.deepEqual(nonSuccess, {
    ok: false,
    safeFailureCode: "provider_send_failed",
  });
  assert(!JSON.stringify(nonSuccess).includes(providerBodySentinel));

  const networkFailure = await sendInitialAssignmentEmail(resendConfiguration, input, {
    fetch: async () => {
      throw new Error(`${providerBodySentinel}:${apiKey}:${scheduleAccessUrl}`);
    },
  });
  assert.deepEqual(networkFailure, {
    ok: false,
    safeFailureCode: "provider_send_failed",
  });
  assert(!JSON.stringify(networkFailure).includes(providerBodySentinel));
  assert(!JSON.stringify(networkFailure).includes(apiKey));
  assert(!JSON.stringify(networkFailure).includes(scheduleAccessUrl));

  const invalidInput = await sendInitialAssignmentEmail(
    resendConfiguration,
    { ...input, scheduleAccessUrl: `https://example.test/v/access/${bearer}` },
    {
      fetch: async () => {
        throw new Error("Invalid input must fail before fetch.");
      },
    },
  );
  assert.deepEqual(invalidInput, {
    ok: false,
    safeFailureCode: "provider_send_failed",
  });

  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "project-local-resend-"));
  try {
    const recordingPath = path.join(tempDirectory, "assignment-email.jsonl");
    const recordingConfiguration = readInitialAssignmentEmailConfiguration({
      ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT: "recording",
      ASSIGNMENT_NOTIFICATION_BASE_URL: "https://project-local.example.test",
      ASSIGNMENT_NOTIFICATION_FROM: "assignments@project-local.example.test",
      ASSIGNMENT_NOTIFICATION_RECORDING_PATH: recordingPath,
    });
    assert(recordingConfiguration.ok && recordingConfiguration.transport === "recording");
    const recordingResult = await sendInitialAssignmentEmail(
      recordingConfiguration,
      input,
    );
    assert(recordingResult.ok);
    assert.match(recordingResult.providerMessageId, /^recording-[a-f0-9]{24}$/);
    const recording = await readFile(recordingPath, "utf8");
    assert(recording.includes('"scheduleAccessPath":"/v/access/[redacted]"'));
    assert(!recording.includes(scheduleAccessUrl));
    assert(!recording.includes(bearer));
    assert(!recording.includes(input.recipientEmail));
    assert(!recording.includes(apiKey));

    const finalizationRecordingPath = path.join(
      tempDirectory,
      "finalization-failure.jsonl",
    );
    const finalizationConfiguration = readInitialAssignmentEmailConfiguration({
      ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT: "recording",
      ASSIGNMENT_NOTIFICATION_BASE_URL: "https://project-local.example.test",
      ASSIGNMENT_NOTIFICATION_FROM: "assignments@project-local.example.test",
      ASSIGNMENT_NOTIFICATION_RECORDING_PATH: finalizationRecordingPath,
    });
    assert(finalizationConfiguration.ok);
    let finalizationCalls = 0;
    const finalizationFailureResult =
      await sendInitialAssignmentNotificationsForItemWithClient(
        {
          rpc: async (name) => {
            if (name === "claim_initial_assignment_notification_deliveries") {
              return {
                data: [
                  {
                    delivery_id: input.deliveryId,
                    calendar_assignment_id: input.assignmentId,
                    volunteer_profile_id: "33333333-3333-4333-8333-333333333333",
                    recipient_email: input.recipientEmail,
                    volunteer_display_name: input.volunteerDisplayName,
                    workspace_display_name: input.workspaceDisplayName,
                    workspace_timezone: "America/Denver",
                    calendar_item_id: "44444444-4444-4444-8444-444444444444",
                    task_title: input.taskTitle,
                    task_type: input.taskType,
                    start_date: input.scheduleDate,
                    start_time: input.scheduleStartTime,
                    end_time: input.scheduleEndTime,
                    schedule_notes: input.scheduleNotes,
                    follow_up_contact_display_name: input.followUpContact.displayName,
                    follow_up_contact_email: input.followUpContact.email,
                    follow_up_contact_phone: input.followUpContact.phone,
                    send_status: "sendable",
                    attempt_count: 1,
                    idempotency_key: input.idempotencyKey,
                  },
                ],
                error: null,
              };
            }
            if (name === "issue_volunteer_schedule_access") {
              return {
                data: [
                  {
                    token_id: "55555555-5555-4555-8555-555555555555",
                    bearer_token: bearer,
                    token_expires_at: input.tokenExpiresAt,
                  },
                ],
                error: null,
              };
            }
            if (name === "revoke_volunteer_schedule_access") {
              return { data: "revoked", error: null };
            }
            if (name === "finalize_initial_assignment_notification_delivery") {
              finalizationCalls += 1;
              return finalizationCalls === 1
                ? { data: null, error: { message: "not surfaced" } }
                : { data: [{ delivery_id: input.deliveryId }], error: null };
            }
            assert.fail(`Unexpected fake RPC: ${name}`);
          },
        },
        { calendarItemId: "44444444-4444-4444-8444-444444444444" },
        finalizationConfiguration,
      );
    assert.equal(finalizationFailureResult.sentCount, 0);
    assert.equal(finalizationFailureResult.failedCount, 1);
    assert.equal(finalizationFailureResult.providerFailureCount, 0);
    assert.equal(finalizationFailureResult.finalizationFailureCount, 1);
    assert.equal(finalizationFailureResult.scheduleAccessFailureCount, 0);
    assert.equal(finalizationFailureResult.tokenRevokedAfterFailureCount, 1);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }

  const [providerSource, calendarClient, migration] = await Promise.all([
    readFile(
      path.join(root, "lib", "notifications", "initialAssignmentEmail.server.ts"),
      "utf8",
    ),
    readFile(path.join(root, "components", "CalendarClient.tsx"), "utf8"),
    readFile(
      path.join(
        root,
        "supabase",
        "migrations",
        "20260714122200_initial_assignment_notifications.sql",
      ),
      "utf8",
    ),
  ]);
  assert(providerSource.startsWith('import "server-only";'));
  assert(!providerSource.includes("console."));
  assert(!providerSource.includes("NEXT_PUBLIC_RESEND"));
  assert(!calendarClient.includes("RESEND_API_KEY"));
  const deliveryLedgerDefinition = migration.slice(
    migration.indexOf("create table public.assignment_notification_deliveries"),
    migration.indexOf("create index assignment_notification_deliveries_workspace_item_idx"),
  );
  assert(!deliveryLedgerDefinition.includes("scheduleAccessPath"));
  assert(!deliveryLedgerDefinition.includes("bearer_token"));

  console.log(
    "Validated disabled, recording, and Resend initial-assignment transports with fake-network request mapping, deterministic provider idempotency, bounded failures, and credential-safe output.",
  );
}

main().catch(() => {
  console.error("Resend initial-assignment transport regression failed safely.");
  process.exit(1);
});
