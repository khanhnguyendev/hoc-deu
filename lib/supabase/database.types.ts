export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      bot_run_users: {
        Row: {
          created_at: string
          detail: Json | null
          id: string
          outcome: string | null
          processed_at: string | null
          run_id: string
          user_id: string
          user_ref: string
          writes: Json
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          id?: string
          outcome?: string | null
          processed_at?: string | null
          run_id: string
          user_id: string
          user_ref: string
          writes?: Json
        }
        Update: {
          created_at?: string
          detail?: Json | null
          id?: string
          outcome?: string | null
          processed_at?: string | null
          run_id?: string
          user_id?: string
          user_ref?: string
          writes?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'bot_run_users_run_id_fkey'
            columns: ['run_id']
            isOneToOne: false
            referencedRelation: 'bot_runs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bot_run_users_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      bot_runs: {
        Row: {
          content_pr_url: string | null
          failure_reason: string | null
          finished_at: string | null
          id: string
          kind: string
          mode: string
          ops_date: string
          run_key: string
          started_at: string
          status: string
          summary: string | null
          users_deferred: number
          users_eligible: number
        }
        Insert: {
          content_pr_url?: string | null
          failure_reason?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          mode: string
          ops_date: string
          run_key: string
          started_at?: string
          status?: string
          summary?: string | null
          users_deferred?: number
          users_eligible?: number
        }
        Update: {
          content_pr_url?: string | null
          failure_reason?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          mode?: string
          ops_date?: string
          run_key?: string
          started_at?: string
          status?: string
          summary?: string | null
          users_deferred?: number
          users_eligible?: number
        }
        Relationships: []
      }
      bot_settings: {
        Row: {
          content_proposals: boolean
          dry_run: boolean
          enabled: boolean
          id: boolean
          limits: Json
          per_run_user_cap: number
          token_hash: string | null
          token_prev_hash: string | null
          token_prev_valid_until: string | null
          token_rotated_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content_proposals?: boolean
          dry_run?: boolean
          enabled?: boolean
          id?: boolean
          limits?: Json
          per_run_user_cap?: number
          token_hash?: string | null
          token_prev_hash?: string | null
          token_prev_valid_until?: string | null
          token_rotated_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content_proposals?: boolean
          dry_run?: boolean
          enabled?: boolean
          id?: boolean
          limits?: Json
          per_run_user_cap?: number
          token_hash?: string | null
          token_prev_hash?: string | null
          token_prev_valid_until?: string | null
          token_rotated_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'bot_settings_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      content_publish_requests: {
        Row: {
          id: number
          pr_url: string | null
          requested_at: string
          requested_by: string | null
          status: string
          target: string
          updated_at: string
        }
        Insert: {
          id?: never
          pr_url?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          target: string
          updated_at?: string
        }
        Update: {
          id?: never
          pr_url?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: string
          target?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'content_publish_requests_requested_by_fkey'
            columns: ['requested_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      daily_activity: {
        Row: {
          completed: boolean
          items_done: number
          local_day: string
          minutes_by_track: Json
          rules_version: number
          user_id: string
          version: number
        }
        Insert: {
          completed?: boolean
          items_done?: number
          local_day: string
          minutes_by_track?: Json
          rules_version?: number
          user_id: string
          version?: number
        }
        Update: {
          completed?: boolean
          items_done?: number
          local_day?: string
          minutes_by_track?: Json
          rules_version?: number
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: 'daily_activity_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      day_plans: {
        Row: {
          blocks: Json
          bot_run_id: string | null
          created_at: string
          id: string
          plan_date: string
          rationale: string | null
          roadmap_weeks: Json
          rules_version: number
          seen_at: string | null
          source: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          blocks: Json
          bot_run_id?: string | null
          created_at?: string
          id?: string
          plan_date: string
          rationale?: string | null
          roadmap_weeks?: Json
          rules_version?: number
          seen_at?: string | null
          source?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          blocks?: Json
          bot_run_id?: string | null
          created_at?: string
          id?: string
          plan_date?: string
          rationale?: string | null
          roadmap_weeks?: Json
          rules_version?: number
          seen_at?: string | null
          source?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: 'day_plans_bot_run_id_fkey'
            columns: ['bot_run_id']
            isOneToOne: false
            referencedRelation: 'bot_runs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'day_plans_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      event_quota: {
        Row: {
          count: number
          local_day: string
          user_id: string
        }
        Insert: {
          count?: number
          local_day: string
          user_id: string
        }
        Update: {
          count?: number
          local_day?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'event_quota_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      events: {
        Row: {
          actor_id: string
          block_id: string | null
          id: string
          item_id: string | null
          local_day: string
          occurred_at: string
          payload: Json
          plan_id: string | null
          rules_version: number
          source: string
          track_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          block_id?: string | null
          id: string
          item_id?: string | null
          local_day: string
          occurred_at?: string
          payload?: Json
          plan_id?: string | null
          rules_version?: number
          source: string
          track_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          block_id?: string | null
          id?: string
          item_id?: string | null
          local_day?: string
          occurred_at?: string
          payload?: Json
          plan_id?: string | null
          rules_version?: number
          source?: string
          track_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'events_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'day_plans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'events_plan_id_user_id_fkey'
            columns: ['plan_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'day_plans'
            referencedColumns: ['id', 'user_id']
          },
          {
            foreignKeyName: 'events_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      item_state: {
        Row: {
          due_on: string | null
          introduced_on: string
          item_id: string
          item_type: string
          lapses: number
          last_result: string | null
          last_result_on: string | null
          level: number
          reps: number
          rules_version: number
          status: string
          top_successes: number
          topic_id: string | null
          track_id: string
          user_id: string
          version: number
          weak: boolean
        }
        Insert: {
          due_on?: string | null
          introduced_on: string
          item_id: string
          item_type: string
          lapses?: number
          last_result?: string | null
          last_result_on?: string | null
          level?: number
          reps?: number
          rules_version?: number
          status: string
          top_successes?: number
          topic_id?: string | null
          track_id: string
          user_id: string
          version?: number
          weak?: boolean
        }
        Update: {
          due_on?: string | null
          introduced_on?: string
          item_id?: string
          item_type?: string
          lapses?: number
          last_result?: string | null
          last_result_on?: string | null
          level?: number
          reps?: number
          rules_version?: number
          status?: string
          top_successes?: number
          topic_id?: string | null
          track_id?: string
          user_id?: string
          version?: number
          weak?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'item_state_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      ops_metrics: {
        Row: {
          id: number
          key: string
          recorded_at: string
          value: number
        }
        Insert: {
          id?: never
          key: string
          recorded_at?: string
          value: number
        }
        Update: {
          id?: never
          key?: string
          recorded_at?: string
          value?: number
        }
        Relationships: []
      }
      plan_block_state: {
        Row: {
          auto: boolean
          block_id: string
          checked_in_at: string
          checked_in_on: string
          minutes: number
          note: string | null
          plan_id: string
          rules_version: number
          status: string
          track_id: string
          user_id: string
          version: number
        }
        Insert: {
          auto?: boolean
          block_id: string
          checked_in_at?: string
          checked_in_on: string
          minutes: number
          note?: string | null
          plan_id: string
          rules_version?: number
          status: string
          track_id: string
          user_id: string
          version?: number
        }
        Update: {
          auto?: boolean
          block_id?: string
          checked_in_at?: string
          checked_in_on?: string
          minutes?: number
          note?: string | null
          plan_id?: string
          rules_version?: number
          status?: string
          track_id?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: 'plan_block_state_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'day_plans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'plan_block_state_plan_id_user_id_fkey'
            columns: ['plan_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'day_plans'
            referencedColumns: ['id', 'user_id']
          },
          {
            foreignKeyName: 'plan_block_state_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          ai_personalization: boolean
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          bot_ref: string
          code_language: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarded_at: string | null
          role: string
          share_notes_with_ai: boolean
          status: string
          updated_at: string
        }
        Insert: {
          ai_personalization?: boolean
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          bot_ref?: string
          code_language?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          onboarded_at?: string | null
          role?: string
          share_notes_with_ai?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          ai_personalization?: boolean
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          bot_ref?: string
          code_language?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarded_at?: string | null
          role?: string
          share_notes_with_ai?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      roadmap_overrides: {
        Row: {
          created_at: string
          created_by_run: string
          id: string
          key: string
          kind: string
          params: Json
          revoked_at: string | null
          start_local_day: string
          status: string
          study_days: number | null
          track_id: string
          until_local_day: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_run: string
          id?: string
          key: string
          kind: string
          params: Json
          revoked_at?: string | null
          start_local_day: string
          status?: string
          study_days?: number | null
          track_id: string
          until_local_day?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by_run?: string
          id?: string
          key?: string
          kind?: string
          params?: Json
          revoked_at?: string | null
          start_local_day?: string
          status?: string
          study_days?: number | null
          track_id?: string
          until_local_day?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'roadmap_overrides_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      schedule_versions: {
        Row: {
          created_at: string
          day_starts_at: string
          effective_at: string
          timezone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_starts_at?: string
          effective_at: string
          timezone?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_starts_at?: string
          effective_at?: string
          timezone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'schedule_versions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      user_items: {
        Row: {
          created_at: string
          created_by_run: string
          created_on: string
          item_id: string
          item_type: string
          payload: Json
          status: string
          topic_id: string
          track_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_run: string
          created_on: string
          item_id: string
          item_type: string
          payload: Json
          status?: string
          topic_id: string
          track_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by_run?: string
          created_on?: string
          item_id?: string
          item_type?: string
          payload?: Json
          status?: string
          topic_id?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_items_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      user_tracks: {
        Row: {
          budget_minutes: number
          created_at: string
          include_bonus: boolean
          new_per_day: number | null
          reset_on: string | null
          roadmap_variant: string
          start_date: string
          status: string
          throttle: Json | null
          track_id: string
          updated_at: string
          user_id: string
          weekly_template: Json | null
        }
        Insert: {
          budget_minutes: number
          created_at?: string
          include_bonus?: boolean
          new_per_day?: number | null
          reset_on?: string | null
          roadmap_variant: string
          start_date: string
          status?: string
          throttle?: Json | null
          track_id: string
          updated_at?: string
          user_id: string
          weekly_template?: Json | null
        }
        Update: {
          budget_minutes?: number
          created_at?: string
          include_bonus?: boolean
          new_per_day?: number | null
          reset_on?: string | null
          roadmap_variant?: string
          start_date?: string
          status?: string
          throttle?: Json | null
          track_id?: string
          updated_at?: string
          user_id?: string
          weekly_template?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'user_tracks_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_bootstrap: { Args: { p_user_id: string }; Returns: boolean }
      admin_bot_runs: { Args: { p_limit: number }; Returns: Json }
      admin_bot_settings: { Args: never; Returns: Json }
      admin_cancel_publish: { Args: { p_id: number }; Returns: Json }
      admin_list_users: {
        Args: never
        Returns: {
          ai_personalization: boolean
          approved_at: string
          avatar_url: string
          created_at: string
          display_name: string
          email: string
          id: string
          onboarded_at: string
          role: string
          status: string
        }[]
      }
      admin_overview: { Args: never; Returns: Json }
      admin_request_publish: { Args: { p_target: string }; Returns: Json }
      admin_rotate_bot_token: { Args: { p_token_hash: string }; Returns: Json }
      admin_set_ai_flag: {
        Args: { p_on: boolean; p_user_id: string }
        Returns: Json
      }
      admin_set_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: Json
      }
      admin_set_status: {
        Args: { p_expected_from?: string; p_status: string; p_user_id: string }
        Returns: Json
      }
      admin_track_positions: {
        Args: never
        Returns: {
          learners: number
          track_id: string
          variant: string
          week: number
        }[]
      }
      admin_update_bot_settings: {
        Args: {
          p_content_proposals: boolean
          p_dry_run: boolean
          p_enabled: boolean
          p_limits: Json
          p_per_run_user_cap: number
        }
        Returns: Json
      }
      apply_derived_changes: {
        Args: {
          p_changes: Json
          p_event: Json
          p_expected: Json
          p_local_day: string
          p_user_id: string
        }
        Returns: Json
      }
      apply_event: {
        Args: { p_changes?: Json; p_event: Json; p_expected?: Json }
        Returns: Json
      }
      apply_system_event: {
        Args: {
          p_changes?: Json
          p_event: Json
          p_expected?: Json
          p_user_id: string
        }
        Returns: Json
      }
      bot_eligible_users: {
        Args: never
        Returns: {
          last_processed_at: string
          user_id: string
        }[]
      }
      bot_prune_details: { Args: never; Returns: number }
      bot_record_write: {
        Args: {
          p_body_hash: string
          p_entry: Json
          p_kind: string
          p_run_user_id: string
        }
        Returns: Json
      }
      bot_settings_json: {
        Args: { s: Database['public']['Tables']['bot_settings']['Row'] }
        Returns: Json
      }
      bot_timeout_runs: { Args: never; Returns: number }
      bot_track_positions: {
        Args: never
        Returns: {
          learners: number
          track_id: string
          variant: string
          week: number
        }[]
      }
      content_signal_results: {
        Args: { p_days: number }
        Returns: {
          attempts: number
          fails: number
          hints: number
          item_id: string
          users: number
        }[]
      }
      health: { Args: never; Returns: boolean }
      is_active: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      learner_event_types: { Args: never; Returns: string[] }
      local_day: {
        Args: { p_at: string; p_day_starts_at: string; p_timezone: string }
        Returns: string
      }
      mark_plan_seen: { Args: { p_plan_id: string }; Returns: boolean }
      ops_bump_metric: { Args: { p_key: string }; Returns: number }
      ops_prune: { Args: never; Returns: Json }
      ops_record_db_size: { Args: never; Returns: number }
      ops_record_metric: {
        Args: { p_key: string; p_value: number }
        Returns: undefined
      }
      plan_lock_key: {
        Args: { p_plan_date: string; p_user_id: string }
        Returns: number
      }
      publish_clear_pr: { Args: { p_ids: number[] }; Returns: number }
      publish_mark_merged: { Args: { p_ids: number[] }; Returns: number }
      publish_request_json: {
        Args: {
          r: Database['public']['Tables']['content_publish_requests']['Row']
        }
        Returns: Json
      }
      publish_request_targets: { Args: never; Returns: string[] }
      publish_set_pr: {
        Args: { p_ids: number[]; p_pr_url: string }
        Returns: number
      }
      roadmap_override_active: {
        Args: {
          o: Database['public']['Tables']['roadmap_overrides']['Row']
          p_today: string
        }
        Returns: boolean
      }
      rules_version: { Args: never; Returns: number }
      system_event_types: { Args: never; Returns: string[] }
      user_local_day: {
        Args: { p_at: string; p_user_id: string }
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
