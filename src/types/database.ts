// TODO: Generate with `npx supabase gen types typescript` once project is linked
// For now, define manually based on our schema

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          preferred_language: "fr" | "en";
          search_preferences: Json;
          openai_tokens_used: number;
          openai_tokens_limit: number;
          manual_search_count: number;
          manual_search_reset_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          preferred_language?: "fr" | "en";
          search_preferences?: Json;
          openai_tokens_used?: number;
          openai_tokens_limit?: number;
          manual_search_count?: number;
          manual_search_reset_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          preferred_language?: "fr" | "en";
          search_preferences?: Json;
          openai_tokens_used?: number;
          openai_tokens_limit?: number;
          manual_search_count?: number;
          manual_search_reset_at?: string;
        };
        Relationships: [];
      };
      job_listings: {
        Row: {
          id: string;
          source: "jooble" | "adzuna" | "jsearch" | "manual";
          source_id: string | null;
          source_url: string;
          dedup_hash: string;
          title: string;
          company_name: string | null;
          location: string | null;
          location_lat: number | null;
          location_lng: number | null;
          description: string | null;
          salary_min: number | null;
          salary_max: number | null;
          salary_currency: string;
          salary_is_predicted: boolean;
          job_type: string | null;
          category: string | null;
          contract_type: string | null;
          remote_type: "onsite" | "hybrid" | "remote" | "unknown";
          posted_at: string | null;
          fetched_at: string;
          raw_data: Json;
          company_career_url: string | null;
          company_description: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          source: "jooble" | "adzuna" | "jsearch" | "manual";
          source_url: string;
          dedup_hash: string;
          title: string;
          source_id?: string | null;
          company_name?: string | null;
          location?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          description?: string | null;
          salary_min?: number | null;
          salary_max?: number | null;
          salary_currency?: string;
          salary_is_predicted?: boolean;
          job_type?: string | null;
          category?: string | null;
          contract_type?: string | null;
          remote_type?: "onsite" | "hybrid" | "remote" | "unknown";
          posted_at?: string | null;
          raw_data?: Json;
          company_career_url?: string | null;
          company_description?: string | null;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          source?: "jooble" | "adzuna" | "jsearch" | "manual";
          source_id?: string | null;
          source_url?: string;
          dedup_hash?: string;
          title?: string;
          company_name?: string | null;
          location?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          description?: string | null;
          salary_min?: number | null;
          salary_max?: number | null;
          salary_currency?: string;
          salary_is_predicted?: boolean;
          job_type?: string | null;
          category?: string | null;
          contract_type?: string | null;
          remote_type?: "onsite" | "hybrid" | "remote" | "unknown";
          posted_at?: string | null;
          fetched_at?: string;
          raw_data?: Json;
          company_career_url?: string | null;
          company_description?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      resumes: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          file_path: string;
          file_type: "pdf" | "docx" | "txt";
          raw_text: string | null;
          parsed_data: Json;
          is_primary: boolean;
          ai_tokens_used: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          file_name: string;
          file_path: string;
          file_type: "pdf" | "docx" | "txt";
          raw_text?: string | null;
          parsed_data?: Json;
          is_primary?: boolean;
        };
        Update: {
          user_id?: string;
          file_name?: string;
          file_path?: string;
          file_type?: "pdf" | "docx" | "txt";
          raw_text?: string | null;
          parsed_data?: Json;
          is_primary?: boolean;
        };
        Relationships: [];
      };
      seen_jobs: {
        Row: {
          id: string;
          user_id: string;
          job_listing_id: string;
          seen_at: string;
          dismissed: boolean;
        };
        Insert: {
          user_id: string;
          job_listing_id: string;
          dismissed?: boolean;
        };
        Update: {
          user_id?: string;
          job_listing_id?: string;
          dismissed?: boolean;
        };
        Relationships: [];
      };
      match_scores: {
        Row: {
          id: string;
          user_id: string;
          job_listing_id: string;
          resume_id: string;
          overall_score: number;
          skill_match_score: number | null;
          experience_match_score: number | null;
          education_match_score: number | null;
          explanation: string;
          matching_skills: string[];
          missing_skills: string[];
          strengths: string[];
          concerns: string[];
          model_used: string;
          tokens_used: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          job_listing_id: string;
          resume_id: string;
          overall_score: number;
          skill_match_score?: number | null;
          experience_match_score?: number | null;
          education_match_score?: number | null;
          explanation: string;
          matching_skills: string[];
          missing_skills: string[];
          strengths: string[];
          concerns: string[];
        };
        Update: {
          user_id?: string;
          job_listing_id?: string;
          resume_id?: string;
          overall_score?: number;
          skill_match_score?: number | null;
          experience_match_score?: number | null;
          education_match_score?: number | null;
          explanation?: string;
          matching_skills?: string[];
          missing_skills?: string[];
          strengths?: string[];
          concerns?: string[];
        };
        Relationships: [];
      };
      applications: {
        Row: {
          id: string;
          user_id: string;
          job_listing_id: string;
          status:
            | "saved"
            | "applying"
            | "applied"
            | "interview"
            | "offer"
            | "accepted"
            | "rejected"
            | "withdrawn";
          saved_at: string;
          applied_at: string | null;
          interview_at: string | null;
          offer_at: string | null;
          closed_at: string | null;
          resume_id: string | null;
          cover_letter_id: string | null;
          application_method: string | null;
          application_url: string | null;
          recruiter_name: string | null;
          recruiter_email: string | null;
          recruiter_phone: string | null;
          recruiter_linkedin: string | null;
          notes: string | null;
          salary_offered: number | null;
          priority: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          job_listing_id: string;
          status?: "saved" | "applying" | "applied" | "interview" | "offer" | "accepted" | "rejected" | "withdrawn";
          priority?: number;
          notes?: string | null;
          salary_offered?: number | null;
          resume_id?: string | null;
          cover_letter_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          job_listing_id?: string;
          status?: "saved" | "applying" | "applied" | "interview" | "offer" | "accepted" | "rejected" | "withdrawn";
          saved_at?: string;
          applied_at?: string | null;
          interview_at?: string | null;
          offer_at?: string | null;
          closed_at?: string | null;
          resume_id?: string | null;
          cover_letter_id?: string | null;
          application_method?: string | null;
          application_url?: string | null;
          recruiter_name?: string | null;
          recruiter_email?: string | null;
          recruiter_phone?: string | null;
          recruiter_linkedin?: string | null;
          notes?: string | null;
          salary_offered?: number | null;
          priority?: number;
        };
        Relationships: [
          {
            foreignKeyName: "applications_job_listing_id_fkey";
            columns: ["job_listing_id"];
            isOneToOne: false;
            referencedRelation: "job_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      cover_letters: {
        Row: {
          id: string;
          user_id: string;
          job_listing_id: string;
          resume_id: string;
          content: string;
          language: "fr" | "en";
          tone: "professional" | "enthusiastic" | "creative" | "formal";
          version: number;
          is_edited: boolean;
          model_used: string;
          tokens_used: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          job_listing_id: string;
          resume_id: string;
          content: string;
          language?: "fr" | "en";
          tone?: "professional" | "enthusiastic" | "creative" | "formal";
        };
        Update: {
          id?: string;
          user_id?: string;
          job_listing_id?: string;
          resume_id?: string;
          content?: string;
          language?: "fr" | "en";
          tone?: "professional" | "enthusiastic" | "creative" | "formal";
          version?: number;
          is_edited?: boolean;
          model_used?: string;
          tokens_used?: number;
        };
        Relationships: [];
      };
      activity_log: {
        Row: {
          id: string;
          user_id: string;
          application_id: string | null;
          event_type: string;
          event_data: Json;
          description: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          event_type: string;
          description: string;
          application_id?: string;
          event_data?: Json;
        };
        Update: {
          user_id?: string;
          event_type?: string;
          description?: string;
          application_id?: string;
          event_data?: Json;
        };
        Relationships: [];
      };
      api_usage: {
        Row: {
          id: string;
          user_id: string;
          api_name: "openai" | "jooble" | "adzuna" | "jsearch";
          operation: string;
          tokens_input: number;
          tokens_output: number;
          estimated_cost_usd: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          api_name: "openai" | "jooble" | "adzuna" | "jsearch";
          operation: string;
          tokens_input?: number;
          tokens_output?: number;
          estimated_cost_usd?: number;
        };
        Update: {
          user_id?: string;
          api_name?: "openai" | "jooble" | "adzuna" | "jsearch";
          operation?: string;
          tokens_input?: number;
          tokens_output?: number;
          estimated_cost_usd?: number;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
  };
}
