export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      assignment_notification_deliveries: {
        Row: {
          attempt_count: number
          calendar_assignment_id: string
          calendar_item_id: string
          communication_recipient_id: string | null
          created_at: string
          delivery_state: string
          failed_at: string | null
          id: string
          idempotency_key: string
          initiated_by_project_contact_id: string | null
          notification_kind: string
          provider_message_id: string | null
          recipient_email_snapshot: string | null
          safe_failure_code: string | null
          sending_expires_at: string | null
          sending_started_at: string | null
          sent_at: string | null
          template_version: string
          updated_at: string
          volunteer_profile_id: string
          workspace_id: string
        }
        Insert: {
          attempt_count?: number
          calendar_assignment_id: string
          calendar_item_id: string
          communication_recipient_id?: string | null
          created_at?: string
          delivery_state: string
          failed_at?: string | null
          id?: string
          idempotency_key: string
          initiated_by_project_contact_id?: string | null
          notification_kind?: string
          provider_message_id?: string | null
          recipient_email_snapshot?: string | null
          safe_failure_code?: string | null
          sending_expires_at?: string | null
          sending_started_at?: string | null
          sent_at?: string | null
          template_version?: string
          updated_at?: string
          volunteer_profile_id: string
          workspace_id: string
        }
        Update: {
          attempt_count?: number
          calendar_assignment_id?: string
          calendar_item_id?: string
          communication_recipient_id?: string | null
          created_at?: string
          delivery_state?: string
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          initiated_by_project_contact_id?: string | null
          notification_kind?: string
          provider_message_id?: string | null
          recipient_email_snapshot?: string | null
          safe_failure_code?: string | null
          sending_expires_at?: string | null
          sending_started_at?: string | null
          sent_at?: string | null
          template_version?: string
          updated_at?: string
          volunteer_profile_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_notification_deliv_initiated_by_project_contact_fkey"
            columns: ["initiated_by_project_contact_id"]
            isOneToOne: false
            referencedRelation: "project_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_notification_deliveries_assignment_fk"
            columns: ["workspace_id", "calendar_assignment_id"]
            isOneToOne: false
            referencedRelation: "calendar_assignments"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "assignment_notification_deliveries_item_fk"
            columns: ["workspace_id", "calendar_item_id"]
            isOneToOne: false
            referencedRelation: "calendar_items"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "assignment_notification_deliveries_volunteer_fk"
            columns: ["workspace_id", "volunteer_profile_id"]
            isOneToOne: false
            referencedRelation: "volunteer_profiles"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "assignment_notification_deliveries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_communication_recipient_fk"
            columns: ["workspace_id", "communication_recipient_id"]
            isOneToOne: false
            referencedRelation: "communication_recipients"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      assignment_response_link_reveal_events: {
        Row: {
          action: string
          actor_project_contact_id: string
          assignment_id: string
          expires_at: string
          id: string
          metadata: Json
          occurred_at: string
          response_token_id: string
          reveal_mode: string
          reveal_surface: string
          workspace_id: string
        }
        Insert: {
          action?: string
          actor_project_contact_id: string
          assignment_id: string
          expires_at: string
          id?: string
          metadata?: Json
          occurred_at?: string
          response_token_id: string
          reveal_mode: string
          reveal_surface: string
          workspace_id: string
        }
        Update: {
          action?: string
          actor_project_contact_id?: string
          assignment_id?: string
          expires_at?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          response_token_id?: string
          reveal_mode?: string
          reveal_surface?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_response_link_reveal_e_actor_project_contact_id_fkey"
            columns: ["actor_project_contact_id"]
            isOneToOne: false
            referencedRelation: "project_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_response_link_reveal_events_token_scope_fk"
            columns: ["workspace_id", "assignment_id", "response_token_id"]
            isOneToOne: false
            referencedRelation: "assignment_response_tokens"
            referencedColumns: ["workspace_id", "assignment_id", "id"]
          },
          {
            foreignKeyName: "assignment_response_link_reveal_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_response_tokens: {
        Row: {
          assignment_id: string
          created_at: string
          created_by_auth_user_id: string | null
          expires_at: string
          id: string
          internal_note: string | null
          last_used_at: string | null
          purpose: string
          revoked_at: string | null
          token_verifier_hash: string
          updated_at: string
          volunteer_profile_id: string
          workspace_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          created_by_auth_user_id?: string | null
          expires_at: string
          id?: string
          internal_note?: string | null
          last_used_at?: string | null
          purpose?: string
          revoked_at?: string | null
          token_verifier_hash: string
          updated_at?: string
          volunteer_profile_id: string
          workspace_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          expires_at?: string
          id?: string
          internal_note?: string | null
          last_used_at?: string | null
          purpose?: string
          revoked_at?: string | null
          token_verifier_hash?: string
          updated_at?: string
          volunteer_profile_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_response_tokens_assignment_volunteer_workspace_fk"
            columns: ["workspace_id", "assignment_id", "volunteer_profile_id"]
            isOneToOne: false
            referencedRelation: "calendar_assignments"
            referencedColumns: ["workspace_id", "id", "volunteer_profile_id"]
          },
          {
            foreignKeyName: "assignment_response_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_responses: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          responded_at: string | null
          response_note: string | null
          response_source: string
          response_status: string
          updated_at: string
          updated_by_auth_user_id: string | null
          workspace_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          responded_at?: string | null
          response_note?: string | null
          response_source?: string
          response_status?: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
          workspace_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          responded_at?: string | null
          response_note?: string | null
          response_source?: string
          response_status?: string
          updated_at?: string
          updated_by_auth_user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_responses_assignment_workspace_fk"
            columns: ["workspace_id", "assignment_id"]
            isOneToOne: false
            referencedRelation: "calendar_assignments"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "assignment_responses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_assignments: {
        Row: {
          assignment_note: string | null
          calendar_item_id: string
          created_at: string
          created_by_auth_user_id: string | null
          id: string
          lifecycle: string
          updated_at: string
          volunteer_profile_id: string
          workspace_id: string
        }
        Insert: {
          assignment_note?: string | null
          calendar_item_id: string
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          lifecycle?: string
          updated_at?: string
          volunteer_profile_id: string
          workspace_id: string
        }
        Update: {
          assignment_note?: string | null
          calendar_item_id?: string
          created_at?: string
          created_by_auth_user_id?: string | null
          id?: string
          lifecycle?: string
          updated_at?: string
          volunteer_profile_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_assignments_calendar_workspace_fk"
            columns: ["workspace_id", "calendar_item_id"]
            isOneToOne: false
            referencedRelation: "calendar_items"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "calendar_assignments_volunteer_workspace_fk"
            columns: ["workspace_id", "volunteer_profile_id"]
            isOneToOne: false
            referencedRelation: "volunteer_profiles"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "calendar_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_bulk_assignment_operations: {
        Row: {
          actor_id: string
          created_at: string
          plan: Json
          request_id: string
          result: Json
          workspace_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          plan: Json
          request_id: string
          result: Json
          workspace_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          plan?: Json
          request_id?: string
          result?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_bulk_assignment_operations_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "project_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_bulk_assignment_operations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_items: {
        Row: {
          created_at: string
          created_by_project_contact_id: string | null
          custom_values: Json
          end_date: string | null
          end_time: string | null
          follow_up_project_contact_id: string | null
          id: string
          lifecycle: string
          meal_contact: string | null
          meal_kind: string | null
          meal_menu: string | null
          meal_provider: string | null
          meal_total: number | null
          needed_count: number
          publication_state: string
          published_at: string | null
          published_by_project_contact_id: string | null
          schedule_kind: string
          schedule_notes: string | null
          start_date: string
          start_time: string | null
          task_preset_id: string | null
          task_type_snapshot: string
          timezone: string
          title_snapshot: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by_project_contact_id?: string | null
          custom_values?: Json
          end_date?: string | null
          end_time?: string | null
          follow_up_project_contact_id?: string | null
          id?: string
          lifecycle?: string
          meal_contact?: string | null
          meal_kind?: string | null
          meal_menu?: string | null
          meal_provider?: string | null
          meal_total?: number | null
          needed_count: number
          publication_state?: string
          published_at?: string | null
          published_by_project_contact_id?: string | null
          schedule_kind: string
          schedule_notes?: string | null
          start_date: string
          start_time?: string | null
          task_preset_id?: string | null
          task_type_snapshot: string
          timezone: string
          title_snapshot: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by_project_contact_id?: string | null
          custom_values?: Json
          end_date?: string | null
          end_time?: string | null
          follow_up_project_contact_id?: string | null
          id?: string
          lifecycle?: string
          meal_contact?: string | null
          meal_kind?: string | null
          meal_menu?: string | null
          meal_provider?: string | null
          meal_total?: number | null
          needed_count?: number
          publication_state?: string
          published_at?: string | null
          published_by_project_contact_id?: string | null
          schedule_kind?: string
          schedule_notes?: string | null
          start_date?: string
          start_time?: string | null
          task_preset_id?: string | null
          task_type_snapshot?: string
          timezone?: string
          title_snapshot?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_items_created_by_project_contact_id_fkey"
            columns: ["created_by_project_contact_id"]
            isOneToOne: false
            referencedRelation: "project_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_items_follow_up_project_contact_id_fkey"
            columns: ["follow_up_project_contact_id"]
            isOneToOne: false
            referencedRelation: "project_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_items_published_by_project_contact_id_fkey"
            columns: ["published_by_project_contact_id"]
            isOneToOne: false
            referencedRelation: "project_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_items_task_preset_workspace_fk"
            columns: ["workspace_id", "task_preset_id"]
            isOneToOne: false
            referencedRelation: "task_presets"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "calendar_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_repeat_creation_requests: {
        Row: {
          created_at: string
          created_by_project_contact_id: string
          created_item_ids: string[]
          id: string
          request_key: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by_project_contact_id: string
          created_item_ids: string[]
          id?: string
          request_key: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by_project_contact_id?: string
          created_item_ids?: string[]
          id?: string
          request_key?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_repeat_creation_requ_created_by_project_contact_i_fkey"
            columns: ["created_by_project_contact_id"]
            isOneToOne: false
            referencedRelation: "project_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_repeat_creation_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_assignment_coverage: {
        Row: {
          assignment_id: string
          initially_unsent: boolean
          recipient_id: string
          workspace_id: string
        }
        Insert: {
          assignment_id: string
          initially_unsent: boolean
          recipient_id: string
          workspace_id: string
        }
        Update: {
          assignment_id?: string
          initially_unsent?: boolean
          recipient_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_assignment_covera_workspace_id_assignment_id_fkey"
            columns: ["workspace_id", "assignment_id"]
            isOneToOne: false
            referencedRelation: "calendar_assignments"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "communication_assignment_coverag_workspace_id_recipient_id_fkey"
            columns: ["workspace_id", "recipient_id"]
            isOneToOne: false
            referencedRelation: "communication_recipients"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      communication_operations: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          kind: string
          mode: string
          plan: Json
          workspace_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id: string
          kind: string
          mode: string
          plan: Json
          workspace_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          kind?: string
          mode?: string
          plan?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_operations_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "project_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_operations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_recipients: {
        Row: {
          attempt: number
          claim_id: string | null
          claimed_at: string | null
          claimed_by: string | null
          email: string
          failure_code: string | null
          finalized_at: string | null
          id: string
          operation_id: string
          provider_message_id: string | null
          snapshot: Json
          state: string
          volunteer_id: string
          workspace_id: string
        }
        Insert: {
          attempt?: number
          claim_id?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          email: string
          failure_code?: string | null
          finalized_at?: string | null
          id?: string
          operation_id: string
          provider_message_id?: string | null
          snapshot: Json
          state?: string
          volunteer_id: string
          workspace_id: string
        }
        Update: {
          attempt?: number
          claim_id?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          email?: string
          failure_code?: string | null
          finalized_at?: string | null
          id?: string
          operation_id?: string
          provider_message_id?: string | null
          snapshot?: Json
          state?: string
          volunteer_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_recipients_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "project_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_recipients_workspace_id_operation_id_fkey"
            columns: ["workspace_id", "operation_id"]
            isOneToOne: false
            referencedRelation: "communication_operations"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "communication_recipients_workspace_id_volunteer_id_fkey"
            columns: ["workspace_id", "volunteer_id"]
            isOneToOne: false
            referencedRelation: "volunteer_profiles"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      needs_attention_seen_states: {
        Row: {
          project_contact_id: string
          seen_at: string
          signal_id: string
          workspace_id: string
        }
        Insert: {
          project_contact_id: string
          seen_at?: string
          signal_id: string
          workspace_id: string
        }
        Update: {
          project_contact_id?: string
          seen_at?: string
          signal_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "needs_attention_seen_states_project_contact_id_fkey"
            columns: ["project_contact_id"]
            isOneToOne: false
            referencedRelation: "project_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "needs_attention_seen_states_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_contacts: {
        Row: {
          auth_user_id: string
          created_at: string
          id: string
          status: string
          updated_at: string
          volunteer_facing_display_name: string | null
          volunteer_facing_email: string | null
          volunteer_facing_phone: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          volunteer_facing_display_name?: string | null
          volunteer_facing_email?: string | null
          volunteer_facing_phone?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          volunteer_facing_display_name?: string | null
          volunteer_facing_email?: string | null
          volunteer_facing_phone?: string | null
        }
        Relationships: []
      }
      project_days: {
        Row: {
          created_at: string
          created_by_project_contact_id: string
          expected_on_site_count: number | null
          id: string
          project_date: string
          updated_at: string
          updated_by_project_contact_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by_project_contact_id: string
          expected_on_site_count?: number | null
          id?: string
          project_date: string
          updated_at?: string
          updated_by_project_contact_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by_project_contact_id?: string
          expected_on_site_count?: number | null
          id?: string
          project_date?: string
          updated_at?: string
          updated_by_project_contact_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_days_created_by_project_contact_id_fkey"
            columns: ["created_by_project_contact_id"]
            isOneToOne: false
            referencedRelation: "project_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_days_updated_by_project_contact_id_fkey"
            columns: ["updated_by_project_contact_id"]
            isOneToOne: false
            referencedRelation: "project_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_days_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_quick_view_access_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          issued_by_project_contact_id: string | null
          last_used_at: string | null
          purpose: string
          revoked_at: string | null
          token_verifier_hash: string
          token_version: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          issued_by_project_contact_id?: string | null
          last_used_at?: string | null
          purpose?: string
          revoked_at?: string | null
          token_verifier_hash: string
          token_version?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          issued_by_project_contact_id?: string | null
          last_used_at?: string | null
          purpose?: string
          revoked_at?: string | null
          token_verifier_hash?: string
          token_version?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_quick_view_access_tok_issued_by_project_contact_id_fkey"
            columns: ["issued_by_project_contact_id"]
            isOneToOne: false
            referencedRelation: "project_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_quick_view_access_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_submissions: {
        Row: {
          answers: Json
          created_at: string
          id: string
          questionnaire_version: number
          source: string
          status: string
          submitted_at: string
          workspace_id: string
        }
        Insert: {
          answers: Json
          created_at?: string
          id?: string
          questionnaire_version?: number
          source?: string
          status?: string
          submitted_at?: string
          workspace_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          questionnaire_version?: number
          source?: string
          status?: string
          submitted_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_submissions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      task_presets: {
        Row: {
          color_key: string
          created_at: string
          custom_field_definitions: Json
          default_needed_count: number
          description: string | null
          id: string
          is_system_preset: boolean
          lifecycle: string
          name: string
          system_key: string | null
          task_type: string
          updated_at: string
          volunteer_visible: boolean
          workspace_id: string
        }
        Insert: {
          color_key?: string
          created_at?: string
          custom_field_definitions?: Json
          default_needed_count?: number
          description?: string | null
          id?: string
          is_system_preset?: boolean
          lifecycle?: string
          name: string
          system_key?: string | null
          task_type: string
          updated_at?: string
          volunteer_visible?: boolean
          workspace_id: string
        }
        Update: {
          color_key?: string
          created_at?: string
          custom_field_definitions?: Json
          default_needed_count?: number
          description?: string | null
          id?: string
          is_system_preset?: boolean
          lifecycle?: string
          name?: string
          system_key?: string | null
          task_type?: string
          updated_at?: string
          volunteer_visible?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_presets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_away_periods: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          starts_on: string
          volunteer_profile_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id: string
          starts_on: string
          volunteer_profile_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          starts_on?: string
          volunteer_profile_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_away_periods_volunteer_profile_id_workspace_id_fkey"
            columns: ["volunteer_profile_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "volunteer_profiles"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "volunteer_away_periods_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_csv_import_operations: {
        Row: {
          actor_id: string
          created_at: string
          payload_hash: string
          request_id: string
          result: Json
          workspace_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          payload_hash: string
          request_id: string
          result: Json
          workspace_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          payload_hash?: string
          request_id?: string
          result?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_csv_import_operations_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "project_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_csv_import_operations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_lookup_attempts: {
        Row: {
          attempts: number
          bucket: string
          secret: string | null
          window_started_at: string
        }
        Insert: {
          attempts?: number
          bucket: string
          secret?: string | null
          window_started_at?: string
        }
        Update: {
          attempts?: number
          bucket?: string
          secret?: string | null
          window_started_at?: string
        }
        Relationships: []
      }
      volunteer_profiles: {
        Row: {
          after_hours_security_availability: string
          availability_snapshot: Json
          available_two_plus_days: string
          available_work_days: string[]
          builder_assistant_communication: string
          congregation: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          full_name: string
          housing_option: string
          id: string
          lifecycle: string
          manual_created_at: string | null
          manual_created_by_project_contact_id: string | null
          other_support: string | null
          phone: string | null
          preferred_contact_method: string | null
          profile_notes: string
          profile_source: string
          readiness_status: string
          skills_experience: string | null
          skills_help_snapshot: Json
          source_submission_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          after_hours_security_availability?: string
          availability_snapshot: Json
          available_two_plus_days?: string
          available_work_days?: string[]
          builder_assistant_communication?: string
          congregation?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          full_name: string
          housing_option?: string
          id?: string
          lifecycle?: string
          manual_created_at?: string | null
          manual_created_by_project_contact_id?: string | null
          other_support?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          profile_notes?: string
          profile_source?: string
          readiness_status?: string
          skills_experience?: string | null
          skills_help_snapshot: Json
          source_submission_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          after_hours_security_availability?: string
          availability_snapshot?: Json
          available_two_plus_days?: string
          available_work_days?: string[]
          builder_assistant_communication?: string
          congregation?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          full_name?: string
          housing_option?: string
          id?: string
          lifecycle?: string
          manual_created_at?: string | null
          manual_created_by_project_contact_id?: string | null
          other_support?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          profile_notes?: string
          profile_source?: string
          readiness_status?: string
          skills_experience?: string | null
          skills_help_snapshot?: Json
          source_submission_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_profiles_manual_created_by_project_contact_id_fkey"
            columns: ["manual_created_by_project_contact_id"]
            isOneToOne: false
            referencedRelation: "project_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_profiles_source_workspace_fk"
            columns: ["workspace_id", "source_submission_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_submissions"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "volunteer_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_schedule_access_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          issued_by_project_contact_id: string | null
          last_used_at: string | null
          purpose: string
          revoked_at: string | null
          token_verifier_hash: string
          token_version: number
          updated_at: string
          volunteer_profile_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          issued_by_project_contact_id?: string | null
          last_used_at?: string | null
          purpose?: string
          revoked_at?: string | null
          token_verifier_hash: string
          token_version?: number
          updated_at?: string
          volunteer_profile_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          issued_by_project_contact_id?: string | null
          last_used_at?: string | null
          purpose?: string
          revoked_at?: string | null
          token_verifier_hash?: string
          token_version?: number
          updated_at?: string
          volunteer_profile_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_schedule_access_tok_issued_by_project_contact_id_fkey"
            columns: ["issued_by_project_contact_id"]
            isOneToOne: false
            referencedRelation: "project_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_schedule_access_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_schedule_tokens_volunteer_workspace_fk"
            columns: ["workspace_id", "volunteer_profile_id"]
            isOneToOne: false
            referencedRelation: "volunteer_profiles"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      volunteer_welcome_deliveries: {
        Row: {
          campaign: string
          email: string
          recipient_id: string
          sent_at: string
          volunteer_id: string
          workspace_id: string
        }
        Insert: {
          campaign: string
          email: string
          recipient_id: string
          sent_at?: string
          volunteer_id: string
          workspace_id: string
        }
        Update: {
          campaign?: string
          email?: string
          recipient_id?: string
          sent_at?: string
          volunteer_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_welcome_deliveries_workspace_id_recipient_id_fkey"
            columns: ["workspace_id", "recipient_id"]
            isOneToOne: false
            referencedRelation: "communication_recipients"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "volunteer_welcome_deliveries_workspace_id_volunteer_id_fkey"
            columns: ["workspace_id", "volunteer_id"]
            isOneToOne: false
            referencedRelation: "volunteer_profiles"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      workspace_contact_grants: {
        Row: {
          capabilities: string[]
          created_at: string
          id: string
          project_contact_id: string
          revoked_at: string | null
          role: string
          status: string
          updated_at: string
          valid_from: string
          valid_until: string | null
          workspace_id: string
        }
        Insert: {
          capabilities?: string[]
          created_at?: string
          id?: string
          project_contact_id: string
          revoked_at?: string | null
          role: string
          status?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          workspace_id: string
        }
        Update: {
          capabilities?: string[]
          created_at?: string
          id?: string
          project_contact_id?: string
          revoked_at?: string | null
          role?: string
          status?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_contact_grants_project_contact_id_fkey"
            columns: ["project_contact_id"]
            isOneToOne: false
            referencedRelation: "project_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_contact_grants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_project_photos: {
        Row: {
          asset_id: string | null
          desktop_x: number
          desktop_y: number
          mobile_x: number
          mobile_y: number
          updated_at: string
          uploads_enabled: boolean
          version: number
          workspace_id: string
        }
        Insert: {
          asset_id?: string | null
          desktop_x?: number
          desktop_y?: number
          mobile_x?: number
          mobile_y?: number
          updated_at?: string
          uploads_enabled?: boolean
          version?: number
          workspace_id: string
        }
        Update: {
          asset_id?: string | null
          desktop_x?: number
          desktop_y?: number
          mobile_x?: number
          mobile_y?: number
          updated_at?: string
          uploads_enabled?: boolean
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_project_photos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          display_name: string
          ends_on: string | null
          id: string
          lifecycle: string
          public_intake_enabled: boolean
          starts_on: string | null
          timezone: string
          updated_at: string
          workspace_key: string
        }
        Insert: {
          created_at?: string
          display_name: string
          ends_on?: string | null
          id?: string
          lifecycle?: string
          public_intake_enabled?: boolean
          starts_on?: string | null
          timezone?: string
          updated_at?: string
          workspace_key: string
        }
        Update: {
          created_at?: string
          display_name?: string
          ends_on?: string | null
          id?: string
          lifecycle?: string
          public_intake_enabled?: boolean
          starts_on?: string | null
          timezone?: string
          updated_at?: string
          workspace_key?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_calendar_item: {
        Args: { p_calendar_item_id: string }
        Returns: string
      }
      archive_task_preset: { Args: { p_preset_id: string }; Returns: string }
      calendar_assignment_response_start_at: {
        Args: {
          p_schedule_kind: string
          p_start_date: string
          p_start_time: string
          p_timezone: string
        }
        Returns: string
      }
      calendar_custom_values_are_valid: {
        Args: { p_values: Json }
        Returns: boolean
      }
      cancel_calendar_assignment: {
        Args: { p_assignment_id: string }
        Returns: string
      }
      claim_communication_recipient: {
        Args: { p_recipient_id: string; p_retry: boolean }
        Returns: Json
      }
      claim_initial_assignment_notification_deliveries: {
        Args: { p_calendar_item_id: string }
        Returns: {
          attempt_count: number
          calendar_assignment_id: string
          calendar_item_id: string
          delivery_id: string
          end_date: string
          end_time: string
          follow_up_contact_display_name: string
          follow_up_contact_email: string
          follow_up_contact_phone: string
          idempotency_key: string
          needed_count: number
          recipient_email: string
          schedule_kind: string
          schedule_notes: string
          send_status: string
          start_date: string
          start_time: string
          task_title: string
          task_type: string
          volunteer_display_name: string
          volunteer_profile_id: string
          workspace_display_name: string
          workspace_timezone: string
        }[]
      }
      communication_actor: { Args: { p_workspace: string }; Returns: string }
      communication_preview: {
        Args: { p_plan: Json; p_workspace: string }
        Returns: Json
      }
      confirm_all_volunteer_schedule_assignments: {
        Args: { p_bearer_token: string }
        Returns: {
          confirmed_count: number
          response_recorded_at: string
        }[]
      }
      confirm_communication_operation: {
        Args: {
          p_expected_preview: string
          p_operation_id: string
          p_plan: Json
          p_workspace_id: string
        }
        Returns: string
      }
      convert_questionnaire_submission_to_volunteer_profile: {
        Args: { p_submission_id: string }
        Returns: string
      }
      create_calendar_assignment: {
        Args: {
          p_assignment_note: string
          p_calendar_item_id: string
          p_volunteer_profile_id: string
        }
        Returns: string
      }
      create_calendar_assignments_batch: {
        Args: {
          p_assignment_note: string
          p_calendar_item_id: string
          p_volunteer_profile_ids: string[]
        }
        Returns: string[]
      }
      create_calendar_item: {
        Args: {
          p_custom_values: Json
          p_end_date: string
          p_end_time: string
          p_needed_count: number
          p_one_off_task_type: string
          p_one_off_title: string
          p_schedule_kind: string
          p_schedule_notes: string
          p_start_date: string
          p_start_time: string
          p_task_preset_id: string
          p_workspace_id: string
        }
        Returns: string
      }
      create_current_workspace_repeated_calendar_items: {
        Args: {
          p_custom_values: Json
          p_end_date: string
          p_end_time: string
          p_meal_contact: string
          p_meal_kind: string
          p_meal_menu: string
          p_meal_provider: string
          p_meal_total: number
          p_needed_count: number
          p_one_off_task_type: string
          p_one_off_title: string
          p_request_key: string
          p_schedule_notes: string
          p_start_date: string
          p_start_time: string
          p_task_preset_id: string
          p_weekdays: number[]
        }
        Returns: string[]
      }
      create_manual_volunteer_profile: {
        Args: { p_profile: Json; p_workspace_id: string }
        Returns: string
      }
      create_task_preset: {
        Args: {
          p_color_key: string
          p_custom_field_definitions: Json
          p_default_needed_count: number
          p_description: string
          p_name: string
          p_task_type: string
          p_volunteer_visible: boolean
          p_workspace_id: string
        }
        Returns: string
      }
      delete_history_free_volunteer_profile: {
        Args: { p_profile_id: string }
        Returns: string
      }
      duplicate_calendar_item: {
        Args: {
          p_calendar_item_id: string
          p_end_time?: string
          p_start_time?: string
          p_target_date: string
        }
        Returns: string
      }
      finalize_communication_recipient: {
        Args: {
          p_claim_id: string
          p_failure_code: string
          p_outcome: string
          p_provider_id: string
          p_recipient_id: string
        }
        Returns: string
      }
      finalize_initial_assignment_notification_delivery: {
        Args: {
          p_delivery_id: string
          p_delivery_state: string
          p_provider_message_id: string
          p_safe_failure_code: string
        }
        Returns: {
          attempt_count: number
          delivery_id: string
          delivery_state: string
        }[]
      }
      import_volunteer_profiles: {
        Args: { p_request_id: string; p_rows: Json; p_workspace_id: string }
        Returns: Json
      }
      issue_assignment_response_token: {
        Args: {
          p_assignment_id: string
          p_internal_note: string
          p_ttl_hours: number
        }
        Returns: {
          bearer_token: string
          token_expires_at: string
          token_id: string
        }[]
      }
      issue_project_quick_view_access: {
        Args: { p_workspace_id: string }
        Returns: {
          bearer_token: string
          token_expires_at: string
          token_id: string
        }[]
      }
      issue_volunteer_schedule_access: {
        Args: { p_ttl_hours: number; p_volunteer_profile_id: string }
        Returns: {
          bearer_token: string
          token_expires_at: string
          token_id: string
        }[]
      }
      manage_volunteer_away: {
        Args: {
          p_command: string
          p_end: string
          p_expected_preview: string
          p_id: string
          p_start: string
          p_token: string
        }
        Returns: Json
      }
      mark_needs_attention_signal_seen: {
        Args: { p_signal_id: string; p_workspace_id: string }
        Returns: undefined
      }
      plan_calendar_assignments: {
        Args: {
          p_expected_preview: string
          p_plan: Json
          p_request_id: string
          p_workspace_id: string
        }
        Returns: Json
      }
      publish_calendar_item: {
        Args: { p_calendar_item_id: string }
        Returns: string
      }
      read_assignment_detail_context: {
        Args: { p_assignment_id: string }
        Returns: {
          assignment_lifecycle: string
          assignment_reference: string
          calendar_item_reference: string
          can_edit_assignment: boolean
          current_response_source: string
          current_response_status: string
          current_response_updated_at: string
          future_response_link_surface: string
          planned_needed_count: number
          response_link_product_surface_available: boolean
          schedule_kind: string
          schedule_timezone: string
          scheduled_date: string
          scheduled_end_date: string
          scheduled_end_time: string
          scheduled_start_time: string
          task_title: string
          volunteer_congregation: string
          volunteer_display_name: string
          volunteer_profile_reference: string
          workspace_display_name: string
          workspace_reference: string
        }[]
      }
      read_assignment_notification_delivery_health: {
        Args: never
        Returns: {
          delivery_id: string
          delivery_state: string
          sending_expires_at: string
        }[]
      }
      read_assignment_response_by_token: {
        Args: { p_bearer_token: string }
        Returns: {
          assignment_reference: string
          current_response_status: string
          end_date: string
          end_time: string
          schedule_kind: string
          schedule_timezone: string
          start_date: string
          start_time: string
          task_title: string
          workspace_display_name: string
        }[]
      }
      read_communication_history: {
        Args: { p_workspace_id: string }
        Returns: Json
      }
      read_initial_assignment_notification_summaries: {
        Args: { p_calendar_item_ids: string[] }
        Returns: {
          active_assignment_count: number
          already_sent_count: number
          calendar_item_id: string
          eligible_to_send_count: number
          failed_retryable_count: number
          ineligible_count: number
          missing_email_count: number
          missing_follow_up_contact_count: number
          sending_count: number
        }[]
      }
      read_project_quick_view_by_token: {
        Args: { p_bearer_token: string; p_project_date?: string }
        Returns: {
          access_state: string
          expected_on_site_count: number
          project_date: string
          project_ends_on: string
          project_starts_on: string
          schedule_sources: Json
          token_expires_at: string
          workspace_display_name: string
          workspace_timezone: string
        }[]
      }
      read_project_quick_view_share_state: {
        Args: { p_workspace_id: string }
        Returns: {
          active_link_count: number
          latest_expires_at: string
          shared_access_enabled: boolean
        }[]
      }
      read_volunteer_home: {
        Args: { p_token: string; p_week: string }
        Returns: Json
      }
      read_volunteer_schedule: {
        Args: { p_bearer_token: string }
        Returns: {
          active_assigned_count: number
          assignment_reference: string
          can_confirm: boolean
          can_decline: boolean
          confirmed_count: number
          current_response_status: string
          declined_count: number
          end_date: string
          end_time: string
          follow_up_contact_display_name: string
          follow_up_contact_email: string
          follow_up_contact_phone: string
          meal_details: Json
          needed_count: number
          response_lock_reason: string
          response_locked: boolean
          response_note: string
          schedule_kind: string
          schedule_notes: string
          schedule_state: string
          start_date: string
          start_time: string
          task_title: string
          task_type: string
          volunteer_display_name: string
          workspace_display_name: string
          workspace_timezone: string
        }[]
      }
      read_workspace_project_photo: {
        Args: { p_workspace_id: string }
        Returns: Json
      }
      record_assignment_response_link_reveal_event: {
        Args: {
          p_assignment_id: string
          p_expires_at: string
          p_metadata: Json
          p_response_token_id: string
          p_reveal_mode: string
          p_reveal_surface: string
        }
        Returns: {
          actor_project_contact_reference: string
          assignment_reference: string
          event_action: string
          event_id: string
          event_metadata: Json
          event_occurred_at: string
          event_reveal_mode: string
          event_reveal_surface: string
          response_token_reference: string
          token_expires_at: string
        }[]
      }
      replace_assignment_response_token: {
        Args: { p_assignment_id: string; p_ttl_hours: number }
        Returns: {
          bearer_token: string
          token_expires_at: string
          token_id: string
        }[]
      }
      response_link_reveal_metadata_is_valid: {
        Args: { p_metadata: Json }
        Returns: boolean
      }
      reveal_assignment_response_link: {
        Args: {
          p_assignment_id: string
          p_metadata: Json
          p_reveal_mode: string
          p_ttl_hours: number
        }
        Returns: {
          audit_event_id: string
          bearer_token: string
          event_reveal_mode: string
          event_reveal_surface: string
          response_token_id: string
          token_expires_at: string
        }[]
      }
      review_communications: {
        Args: { p_plan: Json; p_workspace_id: string }
        Returns: Json
      }
      revoke_assignment_response_token: {
        Args: { p_token_id: string }
        Returns: string
      }
      revoke_project_quick_view_access: {
        Args: { p_workspace_id: string }
        Returns: number
      }
      revoke_volunteer_schedule_access: {
        Args: { p_token_id: string }
        Returns: string
      }
      save_calendar_meal: {
        Args: {
          p_calendar_item_id: string
          p_contact: string
          p_date: string
          p_end_time: string
          p_expected_updated_at: string
          p_meal_kind: string
          p_menu: string
          p_notes: string
          p_provider: string
          p_start_time: string
          p_total: number
          p_workspace_id: string
        }
        Returns: string
      }
      save_workspace_project_photo: {
        Args: {
          p_asset_id: string
          p_crop: Json
          p_expected_version: number
          p_workspace_id: string
        }
        Returns: Json
      }
      set_current_project_day_expected_on_site: {
        Args: { p_expected_on_site_count: number; p_project_date: string }
        Returns: {
          created_at: string
          expected_on_site_count: number
          project_date: string
          updated_at: string
        }[]
      }
      submit_assignment_response_by_token: {
        Args: {
          p_bearer_token: string
          p_response_note: string
          p_response_status: string
        }
        Returns: {
          assignment_reference: string
          current_response_status: string
          response_recorded_at: string
        }[]
      }
      submit_questionnaire_submission: {
        Args: {
          p_answers: Json
          p_questionnaire_version?: number
          p_workspace_key: string
        }
        Returns: string
      }
      submit_volunteer_schedule_assignment_response: {
        Args: {
          p_assignment_id: string
          p_bearer_token: string
          p_response_note: string
          p_response_status: string
        }
        Returns: {
          assignment_reference: string
          current_response_status: string
          response_note: string
          response_recorded_at: string
        }[]
      }
      task_custom_field_definitions_are_valid: {
        Args: { p_fields: Json }
        Returns: boolean
      }
      update_assignment_response: {
        Args: {
          p_assignment_id: string
          p_response_note: string
          p_response_status: string
        }
        Returns: string
      }
      update_calendar_item_one_off_timed: {
        Args: {
          p_calendar_item_id: string
          p_custom_values: Json
          p_end_time: string
          p_expected_updated_at: string
          p_needed_count: number
          p_one_off_task_type: string
          p_one_off_title: string
          p_schedule_notes: string
          p_start_date: string
          p_start_time: string
        }
        Returns: string
      }
      update_calendar_item_preset_timed: {
        Args: {
          p_calendar_item_id: string
          p_custom_values: Json
          p_end_time: string
          p_expected_updated_at: string
          p_needed_count: number
          p_schedule_notes: string
          p_start_date: string
          p_start_time: string
        }
        Returns: string
      }
      update_current_project_contact_volunteer_facing_details: {
        Args: {
          p_display_name: string
          p_email: string
          p_phone: string
          p_workspace_id: string
        }
        Returns: boolean
      }
      update_current_workspace_project_dates: {
        Args: { p_ends_on: string; p_starts_on: string }
        Returns: {
          ends_on: string
          starts_on: string
        }[]
      }
      update_task_preset_color: {
        Args: {
          p_color_key: string
          p_expected_updated_at: string
          p_preset_id: string
        }
        Returns: string
      }
      update_volunteer_profile_manual_fields: {
        Args: { p_profile: Json; p_profile_id: string }
        Returns: string
      }
      verify_volunteer_schedule_lookup: {
        Args: {
          p_contact: string
          p_full_name: string
          p_project_choice?: string
        }
        Returns: Json
      }
      volunteer_home_identity: {
        Args: { p_token: string }
        Returns: {
          volunteer_id: string
          workspace_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
