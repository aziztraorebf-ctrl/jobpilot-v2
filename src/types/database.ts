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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          application_id: string | null
          created_at: string | null
          description: string
          event_data: Json | null
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string | null
          description: string
          event_data?: Json | null
          event_type: string
          id?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          created_at?: string | null
          description?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage: {
        Row: {
          api_name: string
          created_at: string | null
          estimated_cost_usd: number | null
          id: string
          operation: string
          tokens_input: number | null
          tokens_output: number | null
          user_id: string
        }
        Insert: {
          api_name: string
          created_at?: string | null
          estimated_cost_usd?: number | null
          id?: string
          operation: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id: string
        }
        Update: {
          api_name?: string
          created_at?: string | null
          estimated_cost_usd?: number | null
          id?: string
          operation?: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          agent_notes: string | null
          agent_status: 'pending' | 'ready' | 'submitted' | 'failed' | 'needs_review' | null
          application_method: string | null
          application_url: string | null
          applied_at: string | null
          ats_type: 'linkedin' | 'indeed' | 'workday' | 'greenhouse' | 'lever' | 'other' | null
          closed_at: string | null
          cover_letter_id: string | null
          created_at: string | null
          id: string
          interview_at: string | null
          job_listing_id: string
          notes: string | null
          offer_at: string | null
          priority: number | null
          recruiter_email: string | null
          recruiter_linkedin: string | null
          recruiter_name: string | null
          recruiter_phone: string | null
          resume_id: string | null
          salary_offered: number | null
          saved_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agent_notes?: string | null
          agent_status?: 'pending' | 'ready' | 'submitted' | 'failed' | 'needs_review' | null
          application_method?: string | null
          application_url?: string | null
          applied_at?: string | null
          ats_type?: 'linkedin' | 'indeed' | 'workday' | 'greenhouse' | 'lever' | 'other' | null
          closed_at?: string | null
          cover_letter_id?: string | null
          created_at?: string | null
          id?: string
          interview_at?: string | null
          job_listing_id: string
          notes?: string | null
          offer_at?: string | null
          priority?: number | null
          recruiter_email?: string | null
          recruiter_linkedin?: string | null
          recruiter_name?: string | null
          recruiter_phone?: string | null
          resume_id?: string | null
          salary_offered?: number | null
          saved_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agent_notes?: string | null
          agent_status?: 'pending' | 'ready' | 'submitted' | 'failed' | 'needs_review' | null
          application_method?: string | null
          application_url?: string | null
          applied_at?: string | null
          ats_type?: 'linkedin' | 'indeed' | 'workday' | 'greenhouse' | 'lever' | 'other' | null
          closed_at?: string | null
          cover_letter_id?: string | null
          created_at?: string | null
          id?: string
          interview_at?: string | null
          job_listing_id?: string
          notes?: string | null
          offer_at?: string | null
          priority?: number | null
          recruiter_email?: string | null
          recruiter_linkedin?: string | null
          recruiter_name?: string | null
          recruiter_phone?: string | null
          resume_id?: string | null
          salary_offered?: number | null
          saved_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_listing_id_fkey"
            columns: ["job_listing_id"]
            isOneToOne: false
            referencedRelation: "job_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cover_letter"
            columns: ["cover_letter_id"]
            isOneToOne: false
            referencedRelation: "cover_letters"
            referencedColumns: ["id"]
          },
        ]
      }
      career_conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      career_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
          tokens_used: number | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
          tokens_used?: number | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "career_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "career_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      cover_letters: {
        Row: {
          content: string
          created_at: string | null
          id: string
          integrity_warnings: string[] | null
          is_edited: boolean | null
          job_listing_id: string
          language: string | null
          model_used: string | null
          resume_id: string
          tokens_used: number | null
          tone: string | null
          updated_at: string | null
          user_id: string
          version: number | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          integrity_warnings?: string[] | null
          is_edited?: boolean | null
          job_listing_id: string
          language?: string | null
          model_used?: string | null
          resume_id: string
          tokens_used?: number | null
          tone?: string | null
          updated_at?: string | null
          user_id: string
          version?: number | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          integrity_warnings?: string[] | null
          is_edited?: boolean | null
          job_listing_id?: string
          language?: string | null
          model_used?: string | null
          resume_id?: string
          tokens_used?: number | null
          tone?: string | null
          updated_at?: string | null
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cover_letters_job_listing_id_fkey"
            columns: ["job_listing_id"]
            isOneToOne: false
            referencedRelation: "job_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cover_letters_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cover_letters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_listings: {
        Row: {
          category: string | null
          company_career_url: string | null
          company_description: string | null
          company_name: string | null
          contract_type: string | null
          created_at: string | null
          dedup_hash: string
          description: string | null
          fetched_at: string | null
          id: string
          is_active: boolean | null
          job_type: string | null
          location: string | null
          location_lat: number | null
          location_lng: number | null
          posted_at: string | null
          profile_label: string | null
          raw_data: Json | null
          remote_type: string | null
          salary_currency: string | null
          salary_is_predicted: boolean | null
          salary_max: number | null
          salary_min: number | null
          source: string
          source_id: string | null
          source_url: string
          title: string
        }
        Insert: {
          category?: string | null
          company_career_url?: string | null
          company_description?: string | null
          company_name?: string | null
          contract_type?: string | null
          created_at?: string | null
          dedup_hash: string
          description?: string | null
          fetched_at?: string | null
          id?: string
          is_active?: boolean | null
          job_type?: string | null
          location?: string | null
          location_lat?: number | null
          location_lng?: number | null
          posted_at?: string | null
          profile_label?: string | null
          raw_data?: Json | null
          remote_type?: string | null
          salary_currency?: string | null
          salary_is_predicted?: boolean | null
          salary_max?: number | null
          salary_min?: number | null
          source: string
          source_id?: string | null
          source_url: string
          title: string
        }
        Update: {
          category?: string | null
          company_career_url?: string | null
          company_description?: string | null
          company_name?: string | null
          contract_type?: string | null
          created_at?: string | null
          dedup_hash?: string
          description?: string | null
          fetched_at?: string | null
          id?: string
          is_active?: boolean | null
          job_type?: string | null
          location?: string | null
          location_lat?: number | null
          location_lng?: number | null
          posted_at?: string | null
          profile_label?: string | null
          raw_data?: Json | null
          remote_type?: string | null
          salary_currency?: string | null
          salary_is_predicted?: boolean | null
          salary_max?: number | null
          salary_min?: number | null
          source?: string
          source_id?: string | null
          source_url?: string
          title?: string
        }
        Relationships: []
      }
      match_scores: {
        Row: {
          concerns: string[] | null
          created_at: string | null
          education_match_score: number | null
          experience_match_score: number | null
          explanation: string
          id: string
          job_listing_id: string
          matching_skills: string[] | null
          missing_skills: string[] | null
          model_used: string | null
          overall_score: number
          resume_id: string
          skill_match_score: number | null
          strengths: string[] | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          concerns?: string[] | null
          created_at?: string | null
          education_match_score?: number | null
          experience_match_score?: number | null
          explanation: string
          id?: string
          job_listing_id: string
          matching_skills?: string[] | null
          missing_skills?: string[] | null
          model_used?: string | null
          overall_score: number
          resume_id: string
          skill_match_score?: number | null
          strengths?: string[] | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          concerns?: string[] | null
          created_at?: string | null
          education_match_score?: number | null
          experience_match_score?: number | null
          explanation?: string
          id?: string
          job_listing_id?: string
          matching_skills?: string[] | null
          missing_skills?: string[] | null
          model_used?: string | null
          overall_score?: number
          resume_id?: string
          skill_match_score?: number | null
          strengths?: string[] | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_scores_job_listing_id_fkey"
            columns: ["job_listing_id"]
            isOneToOne: false
            referencedRelation: "job_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_scores_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          manual_search_count: number
          manual_search_reset_at: string
          openai_tokens_limit: number | null
          openai_tokens_used: number | null
          preferred_language: string | null
          search_preferences: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          manual_search_count?: number
          manual_search_reset_at?: string
          openai_tokens_limit?: number | null
          openai_tokens_used?: number | null
          preferred_language?: string | null
          search_preferences?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          manual_search_count?: number
          manual_search_reset_at?: string
          openai_tokens_limit?: number | null
          openai_tokens_used?: number | null
          preferred_language?: string | null
          search_preferences?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      resumes: {
        Row: {
          ai_tokens_used: number | null
          created_at: string | null
          file_name: string
          file_path: string
          file_type: string
          id: string
          is_primary: boolean | null
          parsed_data: Json | null
          raw_text: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_tokens_used?: number | null
          created_at?: string | null
          file_name: string
          file_path: string
          file_type: string
          id?: string
          is_primary?: boolean | null
          parsed_data?: Json | null
          raw_text?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_tokens_used?: number | null
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_type?: string
          id?: string
          is_primary?: boolean | null
          parsed_data?: Json | null
          raw_text?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resumes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seen_jobs: {
        Row: {
          dismissed: boolean | null
          id: string
          job_listing_id: string
          seen_at: string | null
          user_id: string
        }
        Insert: {
          dismissed?: boolean | null
          id?: string
          job_listing_id: string
          seen_at?: string | null
          user_id: string
        }
        Update: {
          dismissed?: boolean | null
          id?: string
          job_listing_id?: string
          seen_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seen_jobs_job_listing_id_fkey"
            columns: ["job_listing_id"]
            isOneToOne: false
            referencedRelation: "job_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seen_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_unscored_jobs: { Args: Record<PropertyKey, never>; Returns: number }
      count_unseen_jobs: { Args: { p_user_id: string }; Returns: number }
      expire_absolute_jobs: { Args: { p_days: number }; Returns: number }
      expire_processed_jobs: { Args: { p_days: number }; Returns: number }
      expire_unseen_jobs: { Args: { p_days: number }; Returns: number }
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
