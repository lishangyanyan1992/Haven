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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      advisor_feedback: {
        Row: {
          created_at: string
          feedback_text: string | null
          id: string
          message_id: string
          rating: number
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_text?: string | null
          id?: string
          message_id: string
          rating: number
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_text?: string | null
          id?: string
          message_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisor_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "advisor_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_message_citations: {
        Row: {
          citation_index: number
          citation_kind: Database["public"]["Enums"]["advisor_citation_kind"]
          created_at: string
          document_id: string | null
          id: string
          knowledge_chunk_id: string | null
          label: string
          message_id: string
          metadata: Json
          quote: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          citation_index?: number
          citation_kind: Database["public"]["Enums"]["advisor_citation_kind"]
          created_at?: string
          document_id?: string | null
          id?: string
          knowledge_chunk_id?: string | null
          label: string
          message_id: string
          metadata?: Json
          quote?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          citation_index?: number
          citation_kind?: Database["public"]["Enums"]["advisor_citation_kind"]
          created_at?: string
          document_id?: string | null
          id?: string
          knowledge_chunk_id?: string | null
          label?: string
          message_id?: string
          metadata?: Json
          quote?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisor_message_citations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_message_citations_knowledge_chunk_id_fkey"
            columns: ["knowledge_chunk_id"]
            isOneToOne: false
            referencedRelation: "knowledge_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_message_citations_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "advisor_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_message_citations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_messages: {
        Row: {
          answer_payload: Json | null
          content: string
          created_at: string
          id: string
          retrieval_metadata: Json
          role: Database["public"]["Enums"]["advisor_message_role"]
          thread_id: string
          user_id: string
        }
        Insert: {
          answer_payload?: Json | null
          content: string
          created_at?: string
          id?: string
          retrieval_metadata?: Json
          role: Database["public"]["Enums"]["advisor_message_role"]
          thread_id: string
          user_id: string
        }
        Update: {
          answer_payload?: Json | null
          content?: string
          created_at?: string
          id?: string
          retrieval_metadata?: Json
          role?: Database["public"]["Enums"]["advisor_message_role"]
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisor_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "advisor_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_threads: {
        Row: {
          created_at: string
          id: string
          status: Database["public"]["Enums"]["advisor_thread_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["advisor_thread_status"]
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["advisor_thread_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisor_threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_advice_summaries: {
        Row: {
          created_at: string
          embedding: string | null
          id: string
          legal_caveat: string
          moderation_status: string
          source_post_id: string | null
          space_id: string | null
          summary: string
          tags: string[]
          title: string
          topic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          id?: string
          legal_caveat: string
          moderation_status?: string
          source_post_id?: string | null
          space_id?: string | null
          summary: string
          tags?: string[]
          title: string
          topic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          embedding?: string | null
          id?: string
          legal_caveat?: string
          moderation_status?: string
          source_post_id?: string | null
          space_id?: string | null
          summary?: string
          tags?: string[]
          title?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_advice_summaries_source_post_id_fkey"
            columns: ["source_post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_advice_summaries_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "community_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      community_memberships: {
        Row: {
          anonymized_label: string
          created_at: string
          id: string
          priority_date_range: string | null
          space_id: string
          top_concern: Database["public"]["Enums"]["concern"]
          user_id: string
        }
        Insert: {
          anonymized_label: string
          created_at?: string
          id?: string
          priority_date_range?: string | null
          space_id: string
          top_concern: Database["public"]["Enums"]["concern"]
          user_id: string
        }
        Update: {
          anonymized_label?: string
          created_at?: string
          id?: string
          priority_date_range?: string | null
          space_id?: string
          top_concern?: Database["public"]["Enums"]["concern"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_memberships_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "community_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_label: string
          body: string
          created_at: string
          id: string
          space_id: string
          tags: string[]
          title: string
          user_id: string | null
        }
        Insert: {
          author_label: string
          body: string
          created_at?: string
          id?: string
          space_id: string
          tags?: string[]
          title: string
          user_id?: string | null
        }
        Update: {
          author_label?: string
          body?: string
          created_at?: string
          id?: string
          space_id?: string
          tags?: string[]
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "community_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_spaces: {
        Row: {
          created_at: string
          id: string
          name: string
          space_type: Database["public"]["Enums"]["community_space_type"]
          summary: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          space_type: Database["public"]["Enums"]["community_space_type"]
          summary: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          space_type?: Database["public"]["Enums"]["community_space_type"]
          summary?: string
        }
        Relationships: []
      }
      derived_signals: {
        Row: {
          ac21_portability_status: string | null
          days_until_visa_expiry: number | null
          estimated_gc_date_range: string | null
          h1b_cap_date: string | null
          layoff_readiness_reasoning: string[]
          layoff_readiness_score: Database["public"]["Enums"]["readiness_level"]
          updated_at: string
          user_id: string
          visa_bulletin_position: string | null
        }
        Insert: {
          ac21_portability_status?: string | null
          days_until_visa_expiry?: number | null
          estimated_gc_date_range?: string | null
          h1b_cap_date?: string | null
          layoff_readiness_reasoning?: string[]
          layoff_readiness_score: Database["public"]["Enums"]["readiness_level"]
          updated_at?: string
          user_id: string
          visa_bulletin_position?: string | null
        }
        Update: {
          ac21_portability_status?: string | null
          days_until_visa_expiry?: number | null
          estimated_gc_date_range?: string | null
          h1b_cap_date?: string | null
          layoff_readiness_reasoning?: string[]
          layoff_readiness_score?: Database["public"]["Enums"]["readiness_level"]
          updated_at?: string
          user_id?: string
          visa_bulletin_position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "derived_signals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_aliases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_extracted_fields: {
        Row: {
          confidence: string
          id: string
          label: string
          record_id: string
          value: string
        }
        Insert: {
          confidence: string
          id?: string
          label: string
          record_id: string
          value: string
        }
        Update: {
          confidence?: string
          id?: string
          label?: string
          record_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_extracted_fields_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "email_ingest_records"
            referencedColumns: ["id"]
          },
        ]
      }
      email_ingest_records: {
        Row: {
          alias: string
          created_at: string
          id: string
          raw_payload: Json | null
          received_at: string
          source_type: Database["public"]["Enums"]["email_source_type"]
          status: Database["public"]["Enums"]["email_record_status"]
          subject: string
          user_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          raw_payload?: Json | null
          received_at: string
          source_type: Database["public"]["Enums"]["email_source_type"]
          status?: Database["public"]["Enums"]["email_record_status"]
          subject: string
          user_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          raw_payload?: Json | null
          received_at?: string
          source_type?: Database["public"]["Enums"]["email_source_type"]
          status?: Database["public"]["Enums"]["email_record_status"]
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_ingest_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          chunk_key: string
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          metadata: Json
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          chunk_key: string
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          chunk_key?: string
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          body_markdown: string
          content_hash: string
          created_at: string
          effective_date: string | null
          fetched_at: string
          id: string
          is_current: boolean
          metadata: Json
          slug: string
          source_id: string
          title: string
          topic: string
          url: string
          version_label: string | null
        }
        Insert: {
          body_markdown: string
          content_hash: string
          created_at?: string
          effective_date?: string | null
          fetched_at?: string
          id?: string
          is_current?: boolean
          metadata?: Json
          slug: string
          source_id: string
          title: string
          topic: string
          url: string
          version_label?: string | null
        }
        Update: {
          body_markdown?: string
          content_hash?: string
          created_at?: string
          effective_date?: string | null
          fetched_at?: string
          id?: string
          is_current?: boolean
          metadata?: Json
          slug?: string
          source_id?: string
          title?: string
          topic?: string
          url?: string
          version_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_sources: {
        Row: {
          agency: string
          base_url: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          slug: string
          topic: string
          trust_priority: number
        }
        Insert: {
          agency: string
          base_url: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          slug: string
          topic: string
          trust_priority?: number
        }
        Update: {
          agency?: string
          base_url?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          slug?: string
          topic?: string
          trust_priority?: number
        }
        Relationships: []
      }
      layoff_checklist_completions: {
        Row: {
          completed_at: string
          event_id: string
          id: string
          item_key: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          event_id: string
          id?: string
          item_key: string
          user_id: string
        }
        Update: {
          completed_at?: string
          event_id?: string
          id?: string
          item_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "layoff_checklist_completions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "layoff_events"
            referencedColumns: ["id"]
          },
        ]
      }
      layoff_events: {
        Row: {
          activated_at: string
          created_at: string
          employer_at_layoff: string | null
          id: string
          layoff_date: string
          resolution_type: string | null
          resolved_at: string | null
          user_id: string
          visa_type_at_layoff: string | null
        }
        Insert: {
          activated_at?: string
          created_at?: string
          employer_at_layoff?: string | null
          id?: string
          layoff_date: string
          resolution_type?: string | null
          resolved_at?: string | null
          user_id: string
          visa_type_at_layoff?: string | null
        }
        Update: {
          activated_at?: string
          created_at?: string
          employer_at_layoff?: string | null
          id?: string
          layoff_date?: string
          resolution_type?: string | null
          resolved_at?: string | null
          user_id?: string
          visa_type_at_layoff?: string | null
        }
        Relationships: []
      }
      source_sync_runs: {
        Row: {
          completed_at: string | null
          details: Json
          error_text: string | null
          id: string
          source_slug: string
          started_at: string
          status: string
          summary: string | null
        }
        Insert: {
          completed_at?: string | null
          details?: Json
          error_text?: string | null
          id?: string
          source_slug: string
          started_at?: string
          status: string
          summary?: string | null
        }
        Update: {
          completed_at?: string | null
          details?: Json
          error_text?: string | null
          id?: string
          source_slug?: string
          started_at?: string
          status?: string
          summary?: string | null
        }
        Relationships: []
      }
      timeline_events: {
        Row: {
          community_link_label: string | null
          created_at: string
          date_label: string
          event_group: Database["public"]["Enums"]["timeline_group"]
          event_kind: string
          explanation: string
          id: string
          next_action: string
          title: string
          user_id: string
        }
        Insert: {
          community_link_label?: string | null
          created_at?: string
          date_label: string
          event_group: Database["public"]["Enums"]["timeline_group"]
          event_kind: string
          explanation: string
          id?: string
          next_action: string
          title: string
          user_id: string
        }
        Update: {
          community_link_label?: string | null
          created_at?: string
          date_label?: string
          event_group?: Database["public"]["Enums"]["timeline_group"]
          event_kind?: string
          explanation?: string
          id?: string
          next_action?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_documents: {
        Row: {
          crisis_critical: boolean
          display_label: string
          document_kind: string
          file_size_bytes: number
          id: string
          metadata: Json
          mime_type: string
          notes: string | null
          original_name: string
          source_kind: string
          storage_path: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          crisis_critical?: boolean
          display_label: string
          document_kind: string
          file_size_bytes: number
          id?: string
          metadata?: Json
          mime_type: string
          notes?: string | null
          original_name: string
          source_kind: string
          storage_path: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          crisis_critical?: boolean
          display_label?: string
          document_kind?: string
          file_size_bytes?: number
          id?: string
          metadata?: Json
          mime_type?: string
          notes?: string | null
          original_name?: string
          source_kind?: string
          storage_path?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          country_of_birth: string
          created_at: string
          current_visa_expiry_date: string | null
          email: string
          employer_industry: string | null
          employer_name: string | null
          employer_size: string | null
          employment_status: Database["public"]["Enums"]["employment_status"]
          full_name: string
          h1b_start_date: string | null
          i140_approval_date: string | null
          i140_approved: boolean
          i485_filed: boolean
          id: string
          job_title: string | null
          perm_filing_date: string | null
          perm_stage: Database["public"]["Enums"]["perm_stage"]
          preference_category: Database["public"]["Enums"]["preference_category"]
          primary_goal: Database["public"]["Enums"]["primary_goal"]
          priority_date: string | null
          spouse_visa_status: Database["public"]["Enums"]["spouse_visa_status"]
          top_concerns: Database["public"]["Enums"]["concern"][]
          updated_at: string
          visa_type: Database["public"]["Enums"]["visa_type"]
        }
        Insert: {
          country_of_birth: string
          created_at?: string
          current_visa_expiry_date?: string | null
          email: string
          employer_industry?: string | null
          employer_name?: string | null
          employer_size?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status"]
          full_name: string
          h1b_start_date?: string | null
          i140_approval_date?: string | null
          i140_approved?: boolean
          i485_filed?: boolean
          id: string
          job_title?: string | null
          perm_filing_date?: string | null
          perm_stage?: Database["public"]["Enums"]["perm_stage"]
          preference_category?: Database["public"]["Enums"]["preference_category"]
          primary_goal?: Database["public"]["Enums"]["primary_goal"]
          priority_date?: string | null
          spouse_visa_status?: Database["public"]["Enums"]["spouse_visa_status"]
          top_concerns?: Database["public"]["Enums"]["concern"][]
          updated_at?: string
          visa_type: Database["public"]["Enums"]["visa_type"]
        }
        Update: {
          country_of_birth?: string
          created_at?: string
          current_visa_expiry_date?: string | null
          email?: string
          employer_industry?: string | null
          employer_name?: string | null
          employer_size?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status"]
          full_name?: string
          h1b_start_date?: string | null
          i140_approval_date?: string | null
          i140_approved?: boolean
          i485_filed?: boolean
          id?: string
          job_title?: string | null
          perm_filing_date?: string | null
          perm_stage?: Database["public"]["Enums"]["perm_stage"]
          preference_category?: Database["public"]["Enums"]["preference_category"]
          primary_goal?: Database["public"]["Enums"]["primary_goal"]
          priority_date?: string | null
          spouse_visa_status?: Database["public"]["Enums"]["spouse_visa_status"]
          top_concerns?: Database["public"]["Enums"]["concern"][]
          updated_at?: string
          visa_type?: Database["public"]["Enums"]["visa_type"]
        }
        Relationships: []
      }
      visa_bulletin_entries: {
        Row: {
          bulletin_month: number
          bulletin_year: number
          category: string
          country: string
          created_at: string
          cutoff_date: string | null
          cutoff_label: string
          id: string
          source_url: string
        }
        Insert: {
          bulletin_month: number
          bulletin_year: number
          category: string
          country: string
          created_at?: string
          cutoff_date?: string | null
          cutoff_label: string
          id?: string
          source_url: string
        }
        Update: {
          bulletin_month?: number
          bulletin_year?: number
          category?: string
          country?: string
          created_at?: string
          cutoff_date?: string | null
          cutoff_label?: string
          id?: string
          source_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_community_advice_summaries: {
        Args: {
          filter_topics?: string[]
          match_count?: number
          query_embedding: string
        }
        Returns: {
          id: string
          legal_caveat: string
          similarity: number
          summary: string
          tags: string[]
          title: string
          topic: string
        }[]
      }
      match_knowledge_chunks: {
        Args: {
          filter_source_slugs?: string[]
          filter_topics?: string[]
          match_count?: number
          query_embedding: string
        }
        Returns: {
          agency: string
          chunk_key: string
          content: string
          document_id: string
          id: string
          similarity: number
          source_slug: string
          title: string
          topic: string
          url: string
        }[]
      }
    }
    Enums: {
      advisor_citation_kind: "external" | "haven" | "community"
      advisor_message_role: "user" | "assistant" | "system"
      advisor_thread_status: "active" | "archived"
      community_space_type: "cohort" | "war_room"
      concern:
        | "layoffs"
        | "visa_expiry"
        | "gc_timeline"
        | "job_change"
        | "other"
      email_record_status: "pending_confirmation" | "accepted" | "rejected"
      email_source_type:
        | "i797_notice"
        | "uscis_receipt"
        | "attorney_update"
        | "rfe_notice"
        | "employer_hr"
        | "priority_date_update"
      employment_status: "employed" | "actively_searching" | "laid_off"
      perm_stage: "not_started" | "in_progress" | "certified" | "denied"
      preference_category: "EB-1" | "EB-2" | "EB-3" | "EB-2 NIW" | "Not sure"
      primary_goal:
        | "get_gc"
        | "job_stability"
        | "explore_options"
        | "stay_flexible"
        | "not_sure"
      readiness_level: "high" | "medium" | "low"
      spouse_visa_status: "none" | "H1B" | "H4" | "H4 EAD" | "GC" | "other"
      timeline_group: "past" | "now" | "upcoming" | "future"
      visa_type: "OPT" | "STEM OPT" | "H1B" | "H4" | "O-1" | "GC" | "Citizen"
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
    Enums: {
      advisor_citation_kind: ["external", "haven", "community"],
      advisor_message_role: ["user", "assistant", "system"],
      advisor_thread_status: ["active", "archived"],
      community_space_type: ["cohort", "war_room"],
      concern: ["layoffs", "visa_expiry", "gc_timeline", "job_change", "other"],
      email_record_status: ["pending_confirmation", "accepted", "rejected"],
      email_source_type: [
        "i797_notice",
        "uscis_receipt",
        "attorney_update",
        "rfe_notice",
        "employer_hr",
        "priority_date_update",
      ],
      employment_status: ["employed", "actively_searching", "laid_off"],
      perm_stage: ["not_started", "in_progress", "certified", "denied"],
      preference_category: ["EB-1", "EB-2", "EB-3", "EB-2 NIW", "Not sure"],
      primary_goal: [
        "get_gc",
        "job_stability",
        "explore_options",
        "stay_flexible",
        "not_sure",
      ],
      readiness_level: ["high", "medium", "low"],
      spouse_visa_status: ["none", "H1B", "H4", "H4 EAD", "GC", "other"],
      timeline_group: ["past", "now", "upcoming", "future"],
      visa_type: ["OPT", "STEM OPT", "H1B", "H4", "O-1", "GC", "Citizen"],
    },
  },
} as const
