export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
      calendar_items: {
        Row: {
          created_at: string
          custom_values: Json
          end_date: string | null
          end_time: string | null
          id: string
          lifecycle: string
          needed_count: number
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
          custom_values?: Json
          end_date?: string | null
          end_time?: string | null
          id?: string
          lifecycle?: string
          needed_count: number
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
          custom_values?: Json
          end_date?: string | null
          end_time?: string | null
          id?: string
          lifecycle?: string
          needed_count?: number
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
      project_contacts: {
        Row: {
          auth_user_id: string
          created_at: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
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
      volunteer_profiles: {
        Row: {
          availability_snapshot: Json
          congregation: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          lifecycle: string
          phone: string | null
          preferred_contact_method: string | null
          profile_notes: string
          readiness_status: string
          skills_help_snapshot: Json
          source_submission_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          availability_snapshot: Json
          congregation?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          lifecycle?: string
          phone?: string | null
          preferred_contact_method?: string | null
          profile_notes?: string
          readiness_status?: string
          skills_help_snapshot: Json
          source_submission_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          availability_snapshot?: Json
          congregation?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          lifecycle?: string
          phone?: string | null
          preferred_contact_method?: string | null
          profile_notes?: string
          readiness_status?: string
          skills_help_snapshot?: Json
          source_submission_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
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
      calendar_custom_values_are_valid: {
        Args: { p_values: Json }
        Returns: boolean
      }
      cancel_calendar_assignment: {
        Args: { p_assignment_id: string }
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
      create_task_preset: {
        Args: {
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
      revoke_assignment_response_token: {
        Args: { p_token_id: string }
        Returns: string
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
