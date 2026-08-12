-- Iteration 12.34.3: Project Local direct-table access is deny-by-default.
-- Migrations are created by postgres; default privileges are creator-role scoped.

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated, PUBLIC;

-- Defense in depth for the complete Project Local table set. Public mutations
-- continue through reviewed security-definer functions rather than table ACLs.
revoke all privileges on table
  public.workspaces,
  public.project_contacts,
  public.workspace_contact_grants,
  public.questionnaire_submissions,
  public.volunteer_profiles,
  public.task_presets,
  public.calendar_items,
  public.calendar_assignments,
  public.assignment_responses,
  public.assignment_response_tokens,
  public.assignment_response_link_reveal_events,
  public.volunteer_schedule_access_tokens,
  public.assignment_notification_deliveries
from anon, authenticated, PUBLIC;

grant select on table
  public.workspaces,
  public.project_contacts,
  public.workspace_contact_grants,
  public.questionnaire_submissions,
  public.volunteer_profiles,
  public.task_presets,
  public.calendar_items,
  public.calendar_assignments,
  public.assignment_responses
to authenticated;
