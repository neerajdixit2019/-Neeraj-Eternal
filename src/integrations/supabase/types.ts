export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          mode: string
          summary: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          summary?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          summary?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          risk_label: string | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          risk_label?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          risk_label?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_invocations: {
        Row: {
          created_at: string
          error_code: string | null
          id: string
          input_chars: number | null
          latency_ms: number | null
          metadata: Json
          model: string
          output_chars: number | null
          prompt_version_id: string | null
          route: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          id?: string
          input_chars?: number | null
          latency_ms?: number | null
          metadata?: Json
          model: string
          output_chars?: number | null
          prompt_version_id?: string | null
          route: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          id?: string
          input_chars?: number | null
          latency_ms?: number | null
          metadata?: Json
          model?: string
          output_chars?: number | null
          prompt_version_id?: string | null
          route?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_invocations_prompt_version_id_fkey"
            columns: ["prompt_version_id"]
            isOneToOne: false
            referencedRelation: "ai_prompt_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_versions: {
        Row: {
          created_at: string
          hash: string
          id: string
          metadata: Json
          model: string
          prompt_name: string
          system_text: string
        }
        Insert: {
          created_at?: string
          hash: string
          id?: string
          metadata?: Json
          model: string
          prompt_name: string
          system_text: string
        }
        Update: {
          created_at?: string
          hash?: string
          id?: string
          metadata?: Json
          model?: string
          prompt_name?: string
          system_text?: string
        }
        Relationships: []
      }
      ai_rate_limits: {
        Row: {
          count: number
          route: string
          user_id: string
          window_start: string
        }
        Insert: {
          count?: number
          route: string
          user_id: string
          window_start: string
        }
        Update: {
          count?: number
          route?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      consent_records: {
        Row: {
          accepted_at: string
          consent_type: string
          consent_version: string
          id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          consent_type: string
          consent_version?: string
          id?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          consent_type?: string
          consent_version?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string | null
          rating: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          rating?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          rating?: number | null
          user_id?: string
        }
        Relationships: []
      }
      healing_paths: {
        Row: {
          created_at: string
          description: string
          duration_days: number
          id: string
          slug: string
          theme: string
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          duration_days: number
          id?: string
          slug: string
          theme: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          duration_days?: number
          id?: string
          slug?: string
          theme?: string
          title?: string
        }
        Relationships: []
      }
      healing_steps: {
        Row: {
          day_number: number
          exercise_text: string
          id: string
          journal_prompt: string
          order_index: number
          path_id: string
          title: string
        }
        Insert: {
          day_number: number
          exercise_text: string
          id?: string
          journal_prompt: string
          order_index?: number
          path_id: string
          title: string
        }
        Update: {
          day_number?: number
          exercise_text?: string
          id?: string
          journal_prompt?: string
          order_index?: number
          path_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "healing_steps_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "healing_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          body: string
          created_at: string
          emotion_tags: string[]
          entry_type: string
          id: string
          is_ai_readable: boolean
          mood_before: number | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          emotion_tags?: string[]
          entry_type?: string
          id?: string
          is_ai_readable?: boolean
          mood_before?: number | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          emotion_tags?: string[]
          entry_type?: string
          id?: string
          is_ai_readable?: boolean
          mood_before?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          created_at: string
          feeling_tag: string | null
          id: string
          is_ai_readable: boolean
          media_path: string | null
          media_type: string | null
          memory_date: string | null
          story: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          feeling_tag?: string | null
          id?: string
          is_ai_readable?: boolean
          media_path?: string | null
          media_type?: string | null
          memory_date?: string | null
          story?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          feeling_tag?: string | null
          id?: string
          is_ai_readable?: boolean
          media_path?: string | null
          media_type?: string | null
          memory_date?: string | null
          story?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mood_logs: {
        Row: {
          created_at: string
          emotion_tags: string[]
          energy_score: number | null
          id: string
          mood_score: number
          note: string | null
          trigger_tags: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          emotion_tags?: string[]
          energy_score?: number | null
          id?: string
          mood_score: number
          note?: string | null
          trigger_tags?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          emotion_tags?: string[]
          energy_score?: number | null
          id?: string
          mood_score?: number
          note?: string | null
          trigger_tags?: string[]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_gate_passed: boolean
          background_animation_enabled: boolean
          companion_tone: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarding_completed: boolean
          primary_struggle: string | null
          updated_at: string
          weekly_letter_enabled: boolean
          weekly_letter_uses_memories: boolean
        }
        Insert: {
          age_gate_passed?: boolean
          background_animation_enabled?: boolean
          companion_tone?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          onboarding_completed?: boolean
          primary_struggle?: string | null
          updated_at?: string
          weekly_letter_enabled?: boolean
          weekly_letter_uses_memories?: boolean
        }
        Update: {
          age_gate_passed?: boolean
          background_animation_enabled?: boolean
          companion_tone?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean
          primary_struggle?: string | null
          updated_at?: string
          weekly_letter_enabled?: boolean
          weekly_letter_uses_memories?: boolean
        }
        Relationships: []
      }
      reflection_journal_entries: {
        Row: {
          content: string
          created_at: string
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reflection_journal_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "reflection_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      reflection_sessions: {
        Row: {
          ai_reply_count: number
          category: string
          closed_at: string | null
          closure_reason: string | null
          created_at: string
          id: string
          intensity: number
          save_mode: string
          user_id: string
        }
        Insert: {
          ai_reply_count?: number
          category: string
          closed_at?: string | null
          closure_reason?: string | null
          created_at?: string
          id?: string
          intensity: number
          save_mode: string
          user_id: string
        }
        Update: {
          ai_reply_count?: number
          category?: string
          closed_at?: string | null
          closure_reason?: string | null
          created_at?: string
          id?: string
          intensity?: number
          save_mode?: string
          user_id?: string
        }
        Relationships: []
      }
      reflection_turns: {
        Row: {
          ai_response: Json
          created_at: string
          id: string
          risk_level: string
          session_id: string
          turn_number: number
          user_id: string
          user_message: string
        }
        Insert: {
          ai_response: Json
          created_at?: string
          id?: string
          risk_level: string
          session_id: string
          turn_number: number
          user_id: string
          user_message: string
        }
        Update: {
          ai_response?: Json
          created_at?: string
          id?: string
          risk_level?: string
          session_id?: string
          turn_number?: number
          user_id?: string
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "reflection_turns_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "reflection_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      reflections: {
        Row: {
          created_at: string
          encourage_human_support: boolean
          gentle_question: string
          id: string
          micro_action: Json
          model_name: string | null
          possible_underneath: Json
          response_mode: string | null
          risk_level: string
          session_id: string
          show_crisis_support: boolean
          source: string
          title: string
          user_id: string
          what_i_hear: string
        }
        Insert: {
          created_at?: string
          encourage_human_support?: boolean
          gentle_question: string
          id?: string
          micro_action: Json
          model_name?: string | null
          possible_underneath: Json
          response_mode?: string | null
          risk_level?: string
          session_id: string
          show_crisis_support?: boolean
          source?: string
          title: string
          user_id: string
          what_i_hear: string
        }
        Update: {
          created_at?: string
          encourage_human_support?: boolean
          gentle_question?: string
          id?: string
          micro_action?: Json
          model_name?: string | null
          possible_underneath?: Json
          response_mode?: string | null
          risk_level?: string
          session_id?: string
          show_crisis_support?: boolean
          source?: string
          title?: string
          user_id?: string
          what_i_hear?: string
        }
        Relationships: [
          {
            foreignKeyName: "reflections_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "reflection_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      rights_requests: {
        Row: {
          completed_at: string | null
          id: string
          request_type: string
          status: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          request_type: string
          status?: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          request_type?: string
          status?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: []
      }
      safety_events: {
        Row: {
          action_taken: string
          created_at: string
          event_type: string
          flagged_categories: Json
          id: string
          idempotency_key: string | null
          resource_shown: string | null
          risk_level: string
          session_id: string | null
          severity: string
          user_id: string
        }
        Insert: {
          action_taken?: string
          created_at?: string
          event_type: string
          flagged_categories?: Json
          id?: string
          idempotency_key?: string | null
          resource_shown?: string | null
          risk_level?: string
          session_id?: string | null
          severity?: string
          user_id: string
        }
        Update: {
          action_taken?: string
          created_at?: string
          event_type?: string
          flagged_categories?: Json
          id?: string
          idempotency_key?: string | null
          resource_shown?: string | null
          risk_level?: string
          session_id?: string | null
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "reflection_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          category: string | null
          comment: string | null
          created_at: string
          helpful: boolean
          id: string
          intensity: number | null
          rating: string | null
          reasons: string[]
          reflection_id: string | null
          response_mode: string | null
          save_mode: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          comment?: string | null
          created_at?: string
          helpful: boolean
          id?: string
          intensity?: number | null
          rating?: string | null
          reasons?: string[]
          reflection_id?: string | null
          response_mode?: string | null
          save_mode?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          comment?: string | null
          created_at?: string
          helpful?: boolean
          id?: string
          intensity?: number | null
          rating?: string | null
          reasons?: string[]
          reflection_id?: string | null
          response_mode?: string | null
          save_mode?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_reflection_id_fkey"
            columns: ["reflection_id"]
            isOneToOne: false
            referencedRelation: "reflections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_path_progress: {
        Row: {
          completed_steps: number[]
          current_day: number
          id: string
          last_active_at: string
          path_id: string
          user_id: string
        }
        Insert: {
          completed_steps?: number[]
          current_day?: number
          id?: string
          last_active_at?: string
          path_id: string
          user_id: string
        }
        Update: {
          completed_steps?: number[]
          current_day?: number
          id?: string
          last_active_at?: string
          path_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_path_progress_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "healing_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      user_story: {
        Row: {
          current_chapter: string | null
          healing_from: string | null
          is_ai_readable: boolean
          people: string | null
          roots: string | null
          speaking_preference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          current_chapter?: string | null
          healing_from?: string | null
          is_ai_readable?: boolean
          people?: string | null
          roots?: string | null
          speaking_preference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          current_chapter?: string | null
          healing_from?: string | null
          is_ai_readable?: boolean
          people?: string | null
          roots?: string | null
          speaking_preference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_letters: {
        Row: {
          body: string
          check_in_echo: string | null
          created_at: string
          generated_at: string
          id: string
          kept: boolean
          ritual: string | null
          tone: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          body: string
          check_in_echo?: string | null
          created_at?: string
          generated_at?: string
          id?: string
          kept?: boolean
          ritual?: string | null
          tone?: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          body?: string
          check_in_echo?: string | null
          created_at?: string
          generated_at?: string
          id?: string
          kept?: boolean
          ritual?: string | null
          tone?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_ai_rate_limit: {
        Args: {
          p_limit: number
          p_route: string
          p_user_id: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          reset_at: string
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
