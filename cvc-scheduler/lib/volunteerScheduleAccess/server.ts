import "server-only";

import { createClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { readSupabasePublicConfig } from "@/lib/supabase/config";
import type { AppSupabaseClient, PublicRpcArgs } from "@/lib/supabase/types";
import { normalizeWorkspaceReference } from "@/lib/workspaces/identity";
import {
  parseIssuedVolunteerScheduleAccess,
  parseVolunteerScheduleRows,
  validateIssueVolunteerScheduleAccessInput,
  validateReadVolunteerScheduleInput,
  validateRevokeVolunteerScheduleAccessInput,
  type IssueVolunteerScheduleAccessInput,
  type ReadVolunteerScheduleInput,
  type RevokeVolunteerScheduleAccessInput,
} from "./token";

export const volunteerScheduleAccessCookie = {
  name: "pl-volunteer-schedule",
  path: "/v",
} as const;

function createVolunteerScheduleReadClient(): AppSupabaseClient {
  const config = readSupabasePublicConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function requireAuthenticatedContact(supabase: AppSupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Volunteer schedule access changes require an authenticated contact.");
  }
}

export async function issueVolunteerScheduleAccessWithClient(
  supabase: AppSupabaseClient,
  input: IssueVolunteerScheduleAccessInput | unknown,
) {
  await requireAuthenticatedContact(supabase);
  const tokenRequest = validateIssueVolunteerScheduleAccessInput(input);
  const { data, error } = await supabase.rpc(
    "issue_volunteer_schedule_access",
    {
      p_volunteer_profile_id: tokenRequest.volunteerProfileId,
      p_ttl_hours: tokenRequest.expiresInHours,
    } as PublicRpcArgs<"issue_volunteer_schedule_access">,
  );
  if (error) {
    throw new Error("Volunteer schedule access could not be issued.", { cause: error });
  }
  return parseIssuedVolunteerScheduleAccess(data);
}

export async function issueVolunteerScheduleAccess(
  input: IssueVolunteerScheduleAccessInput | unknown,
) {
  const supabase = await createServerSupabaseClient();
  return issueVolunteerScheduleAccessWithClient(supabase, input);
}

export async function revokeVolunteerScheduleAccessWithClient(
  supabase: AppSupabaseClient,
  input: RevokeVolunteerScheduleAccessInput | unknown,
) {
  await requireAuthenticatedContact(supabase);
  const tokenRequest = validateRevokeVolunteerScheduleAccessInput(input);
  const { data, error } = await supabase.rpc("revoke_volunteer_schedule_access", {
    p_token_id: tokenRequest.tokenId,
  } as PublicRpcArgs<"revoke_volunteer_schedule_access">);
  if (error || typeof data !== "string") {
    throw new Error("Volunteer schedule access could not be revoked.", { cause: error });
  }
  return { tokenId: normalizeWorkspaceReference({ id: data }).value };
}

export async function revokeVolunteerScheduleAccess(
  input: RevokeVolunteerScheduleAccessInput | unknown,
) {
  const supabase = await createServerSupabaseClient();
  return revokeVolunteerScheduleAccessWithClient(supabase, input);
}

export async function readVolunteerScheduleWithClient(
  supabase: AppSupabaseClient,
  input: ReadVolunteerScheduleInput | unknown,
) {
  const tokenRequest = validateReadVolunteerScheduleInput(input);
  const { data, error } = await supabase.rpc("read_volunteer_schedule", {
    p_bearer_token: tokenRequest.token,
  } as PublicRpcArgs<"read_volunteer_schedule">);
  if (error) {
    throw new Error("Volunteer schedule is unavailable.", { cause: error });
  }
  return parseVolunteerScheduleRows(data);
}

export async function readVolunteerSchedule(input: ReadVolunteerScheduleInput | unknown) {
  const supabase = createVolunteerScheduleReadClient();
  return readVolunteerScheduleWithClient(supabase, input);
}
