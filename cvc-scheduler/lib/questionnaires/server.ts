import "server-only";

import {
  questionnaireAnswerVersion,
  validateQuestionnaireSubmissionPayload,
  type QuestionnaireAnswersV1,
} from "@/lib/questionnaires/payload";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppSupabaseClient, PublicRpcArgs } from "@/lib/supabase/types";
import { normalizeWorkspaceReference } from "@/lib/workspaces/identity";

export type QuestionnaireSubmission = Readonly<{
  id: string;
  workspaceId: string;
  status: "submitted" | "in_review" | "needs_follow_up" | "approved" | "rejected";
  source: "public_web" | "paper_entry" | "admin_entry";
  questionnaireVersion: number;
  answers: QuestionnaireAnswersV1;
  submittedAt: string;
  createdAt: string;
}>;

export type PublicQuestionnaireSubmissionReceipt = Readonly<{
  submissionId: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseQuestionnaireSubmission(value: unknown): QuestionnaireSubmission {
  if (!isRecord(value)) {
    throw new Error("Questionnaire submission read returned an invalid row.");
  }

  const status = value.status;
  const source = value.source;
  if (
    status !== "submitted" &&
    status !== "in_review" &&
    status !== "needs_follow_up" &&
    status !== "approved" &&
    status !== "rejected"
  ) {
    throw new Error("Questionnaire submission has an invalid status.");
  }
  if (source !== "public_web" && source !== "paper_entry" && source !== "admin_entry") {
    throw new Error("Questionnaire submission has an invalid source.");
  }
  if (value.questionnaire_version !== questionnaireAnswerVersion) {
    throw new Error("Questionnaire submission has an unsupported version.");
  }

  const id = normalizeWorkspaceReference({ id: String(value.id) }).value;
  const workspaceId = normalizeWorkspaceReference({
    id: String(value.workspace_id),
  }).value;

  if (typeof value.submitted_at !== "string" || typeof value.created_at !== "string") {
    throw new Error("Questionnaire submission has invalid timestamps.");
  }

  return {
    id,
    workspaceId,
    status,
    source,
    questionnaireVersion: questionnaireAnswerVersion,
    answers: validateQuestionnaireSubmissionPayload(value.answers),
    submittedAt: value.submitted_at,
    createdAt: value.created_at,
  };
}

export function validatePublicQuestionnaireSubmissionPayload(payload: unknown) {
  return validateQuestionnaireSubmissionPayload(payload);
}

export async function submitPublicQuestionnaireWithClient(
  supabase: AppSupabaseClient,
  workspaceKey: string,
  payload: unknown,
): Promise<PublicQuestionnaireSubmissionReceipt> {
  const key = normalizeWorkspaceReference({ key: workspaceKey }).value;
  const answers = validatePublicQuestionnaireSubmissionPayload(payload);
  const args = {
    p_workspace_key: key,
    p_answers: answers,
    p_questionnaire_version: questionnaireAnswerVersion,
  } as unknown as PublicRpcArgs<"submit_questionnaire_submission">;
  const { data, error } = await supabase.rpc("submit_questionnaire_submission", args);

  if (error || typeof data !== "string") {
    throw new Error("Questionnaire submission could not be accepted.", { cause: error });
  }

  return {
    submissionId: normalizeWorkspaceReference({ id: data }).value,
  };
}

export async function submitPublicQuestionnaire(
  workspaceKey: string,
  payload: unknown,
) {
  const supabase = await createServerSupabaseClient();
  return submitPublicQuestionnaireWithClient(supabase, workspaceKey, payload);
}

export async function readQuestionnaireSubmissionsWithClient(
  supabase: AppSupabaseClient,
  workspaceId: string,
): Promise<readonly QuestionnaireSubmission[]> {
  const normalizedWorkspaceId = normalizeWorkspaceReference({ id: workspaceId }).value;
  const { data, error } = await supabase
    .from("questionnaire_submissions")
    .select(
      "id,workspace_id,status,source,questionnaire_version,answers,submitted_at,created_at",
    )
    .eq("workspace_id", normalizedWorkspaceId)
    .order("submitted_at", { ascending: false });

  if (error) {
    throw new Error("Questionnaire submissions could not be read.", { cause: error });
  }

  return (data ?? []).map(parseQuestionnaireSubmission);
}

export async function readCurrentContactQuestionnaireSubmissions(workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  return readQuestionnaireSubmissionsWithClient(supabase, workspaceId);
}
