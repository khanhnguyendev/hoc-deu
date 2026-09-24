export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
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
            foreignKeyName: 'events_user_id_fkey'
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
      user_tracks: {
        Row: {
          budget_minutes: number
          created_at: string
          include_bonus: boolean
          new_per_day: number | null
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
      admin_set_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: Json
      }
      admin_set_status: {
        Args: { p_status: string; p_user_id: string }
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
      is_active: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      learner_event_types: { Args: never; Returns: string[] }
      local_day: {
        Args: { p_at: string; p_day_starts_at: string; p_timezone: string }
        Returns: string
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
