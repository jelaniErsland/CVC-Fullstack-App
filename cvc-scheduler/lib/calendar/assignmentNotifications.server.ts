import "server-only";

import {
  buildVolunteerScheduleAccessUrl,
  INITIAL_ASSIGNMENT_EMAIL_TEMPLATE_VERSION,
  readInitialAssignmentEmailConfiguration,
  sendInitialAssignmentEmail,
  type InitialAssignmentEmailConfiguration,
} from "../notifications/initialAssignmentEmail.server.ts";
import type { AppSupabaseClient, PublicRpcArgs } from "../supabase/types.ts";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bearerPattern = /^[A-Za-z0-9_-]{43}$/;

export type InitialAssignmentNotificationSummary = Readonly<{
  calendarItemId: string;
  activeAssignmentCount: number;
  eligibleToSendCount: number;
  alreadySentCount: number;
  missingEmailCount: number;
  missingFollowUpContactCount: number;
  failedRetryableCount: number;
  sendingCount: number;
  ineligibleCount: number;
}>;

type ClaimedInitialAssignmentNotification = Readonly<{
  deliveryId: string;
  calendarAssignmentId: string;
  volunteerProfileId: string;
  recipientEmail: string | null;
  volunteerDisplayName: string;
  workspaceDisplayName: string;
  workspaceTimezone: string;
  calendarItemId: string;
  taskTitle: string;
  taskType: string;
  scheduleDate: string;
  scheduleStartTime: string | null;
  scheduleEndTime: string | null;
  scheduleNotes: string | null;
  followUpContactDisplayName: string | null;
  followUpContactEmail: string | null;
  followUpContactPhone: string | null;
  sendStatus:
    | "sendable"
    | "already_sent"
    | "already_sending"
    | "missing_recipient_email"
    | "missing_follow_up_contact"
    | "not_eligible";
  attemptCount: number;
  idempotencyKey: string;
}>;

export type InitialAssignmentNotificationSendResult = Readonly<{
  sentCount: number;
  alreadySentCount: number;
  skippedCount: number;
  failedCount: number;
  tokenRevokedAfterFailureCount: number;
  providerFailureCount: number;
  finalizationFailureCount: number;
  scheduleAccessFailureCount: number;
}>;

export type InitialAssignmentNotificationBoundaryFailureStage =
  | "configuration"
  | "claim";

export class InitialAssignmentNotificationBoundaryError extends Error {
  readonly safeStage: InitialAssignmentNotificationBoundaryFailureStage;

  constructor(safeStage: InitialAssignmentNotificationBoundaryFailureStage) {
    super("Initial assignment notification operation is unavailable.");
    this.name = "InitialAssignmentNotificationBoundaryError";
    this.safeStage = safeStage;
  }
}

function normalizeUuid(value: unknown) {
  if (typeof value !== "string" || !uuidPattern.test(value.trim())) return null;
  return value.trim().toLowerCase();
}

function normalizeCalendarItemIds(value: readonly string[]) {
  return [...new Set(value.map(normalizeUuid).filter((id): id is string => Boolean(id)))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function nullableText(value: unknown) {
  return value === null || value === undefined ? null : text(value);
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseSummaries(value: unknown): readonly InitialAssignmentNotificationSummary[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((row) => ({
    calendarItemId: normalizeUuid(row.calendar_item_id) ?? "",
    activeAssignmentCount: numberValue(row.active_assignment_count),
    eligibleToSendCount: numberValue(row.eligible_to_send_count),
    alreadySentCount: numberValue(row.already_sent_count),
    missingEmailCount: numberValue(row.missing_email_count),
    missingFollowUpContactCount: numberValue(row.missing_follow_up_contact_count),
    failedRetryableCount: numberValue(row.failed_retryable_count),
    sendingCount: numberValue(row.sending_count),
    ineligibleCount: numberValue(row.ineligible_count),
  })).filter((summary) => Boolean(summary.calendarItemId));
}

function parseClaims(value: unknown): readonly ClaimedInitialAssignmentNotification[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((row) => ({
    deliveryId: normalizeUuid(row.delivery_id) ?? "",
    calendarAssignmentId: normalizeUuid(row.calendar_assignment_id) ?? "",
    volunteerProfileId: normalizeUuid(row.volunteer_profile_id) ?? "",
    recipientEmail: nullableText(row.recipient_email),
    volunteerDisplayName: text(row.volunteer_display_name) ?? "",
    workspaceDisplayName: text(row.workspace_display_name) ?? "",
    workspaceTimezone: text(row.workspace_timezone) ?? "",
    calendarItemId: normalizeUuid(row.calendar_item_id) ?? "",
    taskTitle: text(row.task_title) ?? "",
    taskType: text(row.task_type) ?? "general",
    scheduleDate: text(row.start_date) ?? "",
    scheduleStartTime: nullableText(row.start_time),
    scheduleEndTime: nullableText(row.end_time),
    scheduleNotes: nullableText(row.schedule_notes),
    followUpContactDisplayName: nullableText(row.follow_up_contact_display_name),
    followUpContactEmail: nullableText(row.follow_up_contact_email),
    followUpContactPhone: nullableText(row.follow_up_contact_phone),
    sendStatus: [
      "sendable",
      "already_sent",
      "already_sending",
      "missing_recipient_email",
      "missing_follow_up_contact",
      "not_eligible",
    ].includes(row.send_status as string)
      ? (row.send_status as ClaimedInitialAssignmentNotification["sendStatus"])
      : "not_eligible",
    attemptCount: numberValue(row.attempt_count),
    idempotencyKey: text(row.idempotency_key) ?? "",
  })).filter(
    (claim) =>
      Boolean(claim.deliveryId) &&
      Boolean(claim.calendarAssignmentId) &&
      Boolean(claim.volunteerProfileId) &&
      Boolean(claim.calendarItemId),
  );
}

async function issueVolunteerScheduleAccessForNotification(
  supabase: AppSupabaseClient,
  volunteerProfileId: string,
) {
  const { data, error } = await supabase.rpc("issue_volunteer_schedule_access", {
    p_volunteer_profile_id: volunteerProfileId,
    p_ttl_hours: 720,
  } as PublicRpcArgs<"issue_volunteer_schedule_access">);
  if (error || !Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
    throw new Error("Volunteer schedule access could not be issued.");
  }
  const row = data[0];
  const tokenId = normalizeUuid(row.token_id);
  const token = text(row.bearer_token);
  const expiresAt = text(row.token_expires_at);
  if (!tokenId || !token || !bearerPattern.test(token) || !expiresAt) {
    throw new Error("Volunteer schedule access issuance returned an invalid result.");
  }
  return { tokenId, token, expiresAt };
}

async function revokeVolunteerScheduleAccessForNotification(
  supabase: AppSupabaseClient,
  tokenId: string,
) {
  const { data, error } = await supabase.rpc("revoke_volunteer_schedule_access", {
    p_token_id: tokenId,
  } as PublicRpcArgs<"revoke_volunteer_schedule_access">);
  if (error || typeof data !== "string") {
    throw new Error("Volunteer schedule access could not be revoked.");
  }
}

export async function readInitialAssignmentNotificationSummariesWithClient(input: {
  supabase: AppSupabaseClient;
  calendarItemIds: readonly string[];
  canSendInitialAssignmentNotifications: boolean;
}): Promise<
  | Readonly<{ kind: "ready"; summaries: readonly InitialAssignmentNotificationSummary[] }>
  | Readonly<{ kind: "unavailable" }>
  | Readonly<{ kind: "error" }>
> {
  if (!input.canSendInitialAssignmentNotifications) return { kind: "unavailable" };
  const calendarItemIds = normalizeCalendarItemIds(input.calendarItemIds);
  if (calendarItemIds.length === 0) return { kind: "ready", summaries: [] };

  const { data, error } = await input.supabase.rpc(
    "read_initial_assignment_notification_summaries",
    {
      p_calendar_item_ids: calendarItemIds,
    } as PublicRpcArgs<"read_initial_assignment_notification_summaries">,
  );
  if (error) return { kind: "error" };
  return { kind: "ready", summaries: parseSummaries(data) };
}

async function finalizeDelivery(input: {
  supabase: AppSupabaseClient;
  deliveryId: string;
  state: "sent" | "failed";
  providerMessageId?: string | null;
  safeFailureCode?:
    | "provider_send_failed"
    | "schedule_access_issue_failed"
    | "schedule_access_revoke_failed"
    | "finalize_unavailable";
}) {
  const { error } = await input.supabase.rpc(
    "finalize_initial_assignment_notification_delivery",
    {
      p_delivery_id: input.deliveryId,
      p_delivery_state: input.state,
      p_provider_message_id: input.providerMessageId ?? null,
      p_safe_failure_code: input.safeFailureCode ?? null,
    } as PublicRpcArgs<"finalize_initial_assignment_notification_delivery">,
  );
  if (error) throw new Error("Initial assignment notification could not be finalized.");
}

export async function sendInitialAssignmentNotificationsForItemWithClient(
  supabase: AppSupabaseClient,
  input: { calendarItemId: unknown },
  configuration: InitialAssignmentEmailConfiguration = readInitialAssignmentEmailConfiguration(),
): Promise<InitialAssignmentNotificationSendResult> {
  const calendarItemId = normalizeUuid(input.calendarItemId);
  if (!calendarItemId) throw new Error("Invalid initial assignment notification request.");
  if (!configuration.ok) {
    throw new InitialAssignmentNotificationBoundaryError("configuration");
  }

  const { data, error } = await supabase.rpc(
    "claim_initial_assignment_notification_deliveries",
    {
      p_calendar_item_id: calendarItemId,
    } as PublicRpcArgs<"claim_initial_assignment_notification_deliveries">,
  );
  if (error) throw new InitialAssignmentNotificationBoundaryError("claim");

  const claims = parseClaims(data);
  let sentCount = 0;
  let alreadySentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let tokenRevokedAfterFailureCount = 0;
  let providerFailureCount = 0;
  let finalizationFailureCount = 0;
  let scheduleAccessFailureCount = 0;

  for (const claim of claims) {
    if (claim.sendStatus === "already_sent") {
      alreadySentCount += 1;
      continue;
    }
    if (claim.sendStatus !== "sendable") {
      skippedCount += 1;
      continue;
    }

    if (
      !claim.recipientEmail ||
      !claim.followUpContactDisplayName ||
      !claim.followUpContactEmail
    ) {
      skippedCount += 1;
      continue;
    }

    let issuedTokenId: string | null = null;
    let failureStage:
      | "schedule_access"
      | "provider"
      | "provider_failure_cleanup"
      | "finalization" = "schedule_access";
    try {
      const issued = await issueVolunteerScheduleAccessForNotification(
        supabase,
        claim.volunteerProfileId,
      );
      issuedTokenId = issued.tokenId;
      const scheduleAccessUrl = buildVolunteerScheduleAccessUrl({
        origin: configuration.origin,
        token: issued.token,
      });
      failureStage = "provider";
      const sendResult = await sendInitialAssignmentEmail(configuration, {
        deliveryId: claim.deliveryId,
        assignmentId: claim.calendarAssignmentId,
        idempotencyKey: claim.idempotencyKey,
        recipientEmail: claim.recipientEmail,
        volunteerDisplayName: claim.volunteerDisplayName,
        workspaceDisplayName: claim.workspaceDisplayName,
        taskTitle: claim.taskTitle,
        taskType: claim.taskType,
        scheduleDate: claim.scheduleDate,
        scheduleStartTime: claim.scheduleStartTime,
        scheduleEndTime: claim.scheduleEndTime,
        scheduleNotes: claim.scheduleNotes,
        followUpContact: {
          displayName: claim.followUpContactDisplayName,
          email: claim.followUpContactEmail,
          phone: claim.followUpContactPhone,
        },
        scheduleAccessUrl,
        tokenExpiresAt: issued.expiresAt,
        templateVersion: INITIAL_ASSIGNMENT_EMAIL_TEMPLATE_VERSION,
      });

      if (sendResult.ok) {
        failureStage = "finalization";
        await finalizeDelivery({
          supabase,
          deliveryId: claim.deliveryId,
          state: "sent",
          providerMessageId: sendResult.providerMessageId,
        });
        sentCount += 1;
      } else {
        providerFailureCount += 1;
        failureStage = "provider_failure_cleanup";
        await revokeVolunteerScheduleAccessForNotification(supabase, issued.tokenId);
        tokenRevokedAfterFailureCount += 1;
        failureStage = "finalization";
        await finalizeDelivery({
          supabase,
          deliveryId: claim.deliveryId,
          state: "failed",
          safeFailureCode: sendResult.safeFailureCode,
        });
        failedCount += 1;
      }
    } catch {
      if (failureStage === "schedule_access") {
        scheduleAccessFailureCount += 1;
      } else if (failureStage === "provider") {
        providerFailureCount += 1;
      } else if (failureStage === "finalization") {
        finalizationFailureCount += 1;
      }
      if (issuedTokenId) {
        try {
          await revokeVolunteerScheduleAccessForNotification(supabase, issuedTokenId);
          tokenRevokedAfterFailureCount += 1;
        } catch {
          // The delivery row still receives a safe failure code below.
        }
      }
      try {
        await finalizeDelivery({
          supabase,
          deliveryId: claim.deliveryId,
          state: "failed",
          safeFailureCode: issuedTokenId
            ? "provider_send_failed"
            : "schedule_access_issue_failed",
        });
      } catch {
        if (failureStage !== "finalization") finalizationFailureCount += 1;
      }
      failedCount += 1;
    }
  }

  return {
    sentCount,
    alreadySentCount,
    skippedCount,
    failedCount,
    tokenRevokedAfterFailureCount,
    providerFailureCount,
    finalizationFailureCount,
    scheduleAccessFailureCount,
  };
}
