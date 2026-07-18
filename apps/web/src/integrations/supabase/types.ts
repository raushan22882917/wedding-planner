export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      budget_categories: {
        Row: {
          color: string | null;
          created_at: string;
          id: string;
          name: string;
          planned: number;
          sort_order: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          planned?: number;
          sort_order?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          planned?: number;
          sort_order?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      budget_expenses: {
        Row: {
          amount: number;
          category_id: string | null;
          created_at: string;
          description: string;
          due_date: string | null;
          id: string;
          paid: boolean;
          updated_at: string;
          user_id: string;
          vendor: string | null;
        };
        Insert: {
          amount?: number;
          category_id?: string | null;
          created_at?: string;
          description: string;
          due_date?: string | null;
          id?: string;
          paid?: boolean;
          updated_at?: string;
          user_id: string;
          vendor?: string | null;
        };
        Update: {
          amount?: number;
          category_id?: string | null;
          created_at?: string;
          description?: string;
          due_date?: string | null;
          id?: string;
          paid?: boolean;
          updated_at?: string;
          user_id?: string;
          vendor?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "budget_expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "budget_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_messages: {
        Row: {
          created_at: string;
          id: string;
          message: Json;
          role: string;
          thread_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message: Json;
          role: string;
          thread_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: Json;
          role?: string;
          thread_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "chat_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_threads: {
        Row: {
          created_at: string;
          id: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          created_at: string;
          folder: string;
          id: string;
          mime_type: string | null;
          name: string;
          size_bytes: number | null;
          storage_path: string | null;
          tag: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          folder?: string;
          id?: string;
          mime_type?: string | null;
          name: string;
          size_bytes?: number | null;
          storage_path?: string | null;
          tag?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          folder?: string;
          id?: string;
          mime_type?: string | null;
          name?: string;
          size_bytes?: number | null;
          storage_path?: string | null;
          tag?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      guests: {
        Row: {
          address: string | null;
          created_at: string;
          dietary: string | null;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          plus_one: boolean;
          relationship: string | null;
          rsvp_status: string;
          side: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          dietary?: string | null;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          plus_one?: boolean;
          relationship?: string | null;
          rsvp_status?: string;
          side?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          dietary?: string | null;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          plus_one?: boolean;
          relationship?: string | null;
          rsvp_status?: string;
          side?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      billing_checkouts: {
        Row: {
          coverage_ends_at: string | null;
          created_at: string;
          expected_amount_paise: number;
          expires_at: string;
          id: string;
          kind: "coverage" | "usage_pack";
          paid_at: string | null;
          provider_payment_link_id: string | null;
          provider_short_url: string | null;
          status: "created" | "paid" | "failed" | "expired";
          subscription_plan: "essential" | "signature" | null;
          updated_at: string;
          usage_pack_id: "ai_reply_pack" | "vendor_research_pack" | "availability_call" | null;
          user_id: string;
          wedding_count: number | null;
        };
        Insert: {
          coverage_ends_at?: string | null;
          created_at?: string;
          expected_amount_paise: number;
          expires_at: string;
          id?: string;
          kind: "coverage" | "usage_pack";
          paid_at?: string | null;
          provider_payment_link_id?: string | null;
          provider_short_url?: string | null;
          status?: "created" | "paid" | "failed" | "expired";
          subscription_plan?: "essential" | "signature" | null;
          updated_at?: string;
          usage_pack_id?: "ai_reply_pack" | "vendor_research_pack" | "availability_call" | null;
          user_id: string;
          wedding_count?: number | null;
        };
        Update: {
          coverage_ends_at?: string | null;
          created_at?: string;
          expected_amount_paise?: number;
          expires_at?: string;
          id?: string;
          kind?: "coverage" | "usage_pack";
          paid_at?: string | null;
          provider_payment_link_id?: string | null;
          provider_short_url?: string | null;
          status?: "created" | "paid" | "failed" | "expired";
          subscription_plan?: "essential" | "signature" | null;
          updated_at?: string;
          usage_pack_id?: "ai_reply_pack" | "vendor_research_pack" | "availability_call" | null;
          user_id?: string;
          wedding_count?: number | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          billing_provider: string | null;
          billing_provider_subscription_id: string | null;
          budget_total: number | null;
          city: string | null;
          created_at: string;
          guest_count: number | null;
          id: string;
          onboarding_completed_at: string | null;
          partner_one: string | null;
          partner_one_photo_path: string | null;
          partner_two: string | null;
          partner_two_photo_path: string | null;
          research_consent_at: string | null;
          subscription_plan: "free" | "essential" | "signature";
          subscription_coverage_ends_at: string | null;
          subscription_renews_at: string | null;
          subscription_status: "active" | "pending" | "past_due" | "cancelled" | "expired";
          subscription_trial_eligible: boolean;
          subscription_trial_started_at: string | null;
          subscription_wedding_count: number;
          updated_at: string;
          venue: string | null;
          wedding_date: string | null;
          wedding_brief: Json;
        };
        Insert: {
          billing_provider?: string | null;
          billing_provider_subscription_id?: string | null;
          budget_total?: number | null;
          city?: string | null;
          created_at?: string;
          guest_count?: number | null;
          id: string;
          onboarding_completed_at?: string | null;
          partner_one?: string | null;
          partner_one_photo_path?: string | null;
          partner_two?: string | null;
          partner_two_photo_path?: string | null;
          research_consent_at?: string | null;
          subscription_plan?: "free" | "essential" | "signature";
          subscription_coverage_ends_at?: string | null;
          subscription_renews_at?: string | null;
          subscription_status?: "active" | "pending" | "past_due" | "cancelled" | "expired";
          subscription_trial_eligible?: boolean;
          subscription_trial_started_at?: string | null;
          subscription_wedding_count?: number;
          updated_at?: string;
          venue?: string | null;
          wedding_date?: string | null;
          wedding_brief?: Json;
        };
        Update: {
          billing_provider?: string | null;
          billing_provider_subscription_id?: string | null;
          budget_total?: number | null;
          city?: string | null;
          created_at?: string;
          guest_count?: number | null;
          id?: string;
          onboarding_completed_at?: string | null;
          partner_one?: string | null;
          partner_one_photo_path?: string | null;
          partner_two?: string | null;
          partner_two_photo_path?: string | null;
          research_consent_at?: string | null;
          subscription_plan?: "free" | "essential" | "signature";
          subscription_coverage_ends_at?: string | null;
          subscription_renews_at?: string | null;
          subscription_status?: "active" | "pending" | "past_due" | "cancelled" | "expired";
          subscription_trial_eligible?: boolean;
          subscription_trial_started_at?: string | null;
          subscription_wedding_count?: number;
          updated_at?: string;
          venue?: string | null;
          wedding_date?: string | null;
          wedding_brief?: Json;
        };
        Relationships: [];
      };
      saved_vendors: {
        Row: {
          category: string | null;
          city: string | null;
          contact_email: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          created_at: string;
          id: string;
          name: string;
          notes: string | null;
          price_high: number | null;
          price_low: number | null;
          rating: number | null;
          source_directory_id: string | null;
          status: string;
          updated_at: string;
          user_id: string;
          website: string | null;
        };
        Insert: {
          category?: string | null;
          city?: string | null;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          notes?: string | null;
          price_high?: number | null;
          price_low?: number | null;
          rating?: number | null;
          source_directory_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
          website?: string | null;
        };
        Update: {
          category?: string | null;
          city?: string | null;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          price_high?: number | null;
          price_low?: number | null;
          rating?: number | null;
          source_directory_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "saved_vendors_source_directory_id_fkey";
            columns: ["source_directory_id"];
            isOneToOne: false;
            referencedRelation: "vendor_directory";
            referencedColumns: ["id"];
          },
        ];
      };
      scrape_jobs: {
        Row: {
          attempted_at: string | null;
          completed_at: string | null;
          created_at: string;
          documents_created: number;
          documents_updated: number;
          error: string | null;
          id: string;
          owner_id: string;
          source_id: string;
          status: Database["public"]["Enums"]["scrape_job_status"];
          updated_at: string;
        };
        Insert: {
          attempted_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          documents_created?: number;
          documents_updated?: number;
          error?: string | null;
          id?: string;
          owner_id: string;
          source_id: string;
          status?: Database["public"]["Enums"]["scrape_job_status"];
          updated_at?: string;
        };
        Update: {
          attempted_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          documents_created?: number;
          documents_updated?: number;
          error?: string | null;
          id?: string;
          owner_id?: string;
          source_id?: string;
          status?: Database["public"]["Enums"]["scrape_job_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scrape_jobs_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      search_documents: {
        Row: {
          author: string | null;
          canonical_url: string;
          content: string;
          content_hash: string;
          created_at: string;
          description: string | null;
          external_id: string | null;
          id: string;
          language: string | null;
          metadata: Json;
          owner_id: string;
          published_at: string | null;
          search_vector: unknown;
          source_id: string | null;
          title: string;
          updated_at: string;
          url: string;
        };
        Insert: {
          author?: string | null;
          canonical_url: string;
          content: string;
          content_hash: string;
          created_at?: string;
          description?: string | null;
          external_id?: string | null;
          id?: string;
          language?: string | null;
          metadata?: Json;
          owner_id: string;
          published_at?: string | null;
          search_vector?: unknown;
          source_id?: string | null;
          title: string;
          updated_at?: string;
          url: string;
        };
        Update: {
          author?: string | null;
          canonical_url?: string;
          content?: string;
          content_hash?: string;
          created_at?: string;
          description?: string | null;
          external_id?: string | null;
          id?: string;
          language?: string | null;
          metadata?: Json;
          owner_id?: string;
          published_at?: string | null;
          search_vector?: unknown;
          source_id?: string | null;
          title?: string;
          updated_at?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "search_documents_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      search_queries: {
        Row: {
          created_at: string;
          id: number;
          owner_id: string;
          query: string;
          result_count: number;
        };
        Insert: {
          created_at?: string;
          id?: never;
          owner_id: string;
          query: string;
          result_count?: number;
        };
        Update: {
          created_at?: string;
          id?: never;
          owner_id?: string;
          query?: string;
          result_count?: number;
        };
        Relationships: [];
      };
      subscription_usage_credits: {
        Row: {
          created_at: string;
          cycle_start: string;
          feature: "ai_planner" | "vendor_research" | "whatsapp_send" | "voice_call";
          id: string;
          source_ref: string;
          units: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          cycle_start?: string;
          feature: "ai_planner" | "vendor_research" | "whatsapp_send" | "voice_call";
          id?: string;
          source_ref: string;
          units: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          cycle_start?: string;
          feature?: "ai_planner" | "vendor_research" | "whatsapp_send" | "voice_call";
          id?: string;
          source_ref?: string;
          units?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      sources: {
        Row: {
          config: Json;
          created_at: string;
          enabled: boolean;
          id: string;
          kind: Database["public"]["Enums"]["source_kind"];
          last_crawled_at: string | null;
          name: string;
          owner_id: string;
          updated_at: string;
          url: string;
        };
        Insert: {
          config?: Json;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          kind: Database["public"]["Enums"]["source_kind"];
          last_crawled_at?: string | null;
          name: string;
          owner_id: string;
          updated_at?: string;
          url: string;
        };
        Update: {
          config?: Json;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          kind?: Database["public"]["Enums"]["source_kind"];
          last_crawled_at?: string | null;
          name?: string;
          owner_id?: string;
          updated_at?: string;
          url?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          category: string | null;
          created_at: string;
          done: boolean;
          due_date: string | null;
          id: string;
          notes: string | null;
          priority: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          done?: boolean;
          due_date?: string | null;
          id?: string;
          notes?: string | null;
          priority?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          done?: boolean;
          due_date?: string | null;
          id?: string;
          notes?: string | null;
          priority?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      timeline_events: {
        Row: {
          color: string | null;
          created_at: string;
          end_time: string | null;
          event_date: string;
          id: string;
          location: string | null;
          notes: string | null;
          start_time: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          end_time?: string | null;
          event_date: string;
          id?: string;
          location?: string | null;
          notes?: string | null;
          start_time?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          end_time?: string | null;
          event_date?: string;
          id?: string;
          location?: string | null;
          notes?: string | null;
          start_time?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      vendor_directory: {
        Row: {
          address: string | null;
          canonical_url: string;
          capacity: string | null;
          category: string | null;
          city: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          first_seen_at: string;
          id: string;
          image_url: string | null;
          is_published: boolean;
          last_seen_at: string;
          maps_url: string | null;
          name: string;
          price: string | null;
          search_vector: unknown;
          services: Json;
          source_count: number;
          source_excerpt: string | null;
          source_name: string | null;
          source_url: string;
          summary: string | null;
          updated_at: string;
          verification_status: string;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          canonical_url: string;
          capacity?: string | null;
          category?: string | null;
          city?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          first_seen_at?: string;
          id?: string;
          image_url?: string | null;
          is_published?: boolean;
          last_seen_at?: string;
          maps_url?: string | null;
          name: string;
          price?: string | null;
          search_vector?: unknown;
          services?: Json;
          source_count?: number;
          source_excerpt?: string | null;
          source_name?: string | null;
          source_url: string;
          summary?: string | null;
          updated_at?: string;
          verification_status?: string;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          canonical_url?: string;
          capacity?: string | null;
          category?: string | null;
          city?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          first_seen_at?: string;
          id?: string;
          image_url?: string | null;
          is_published?: boolean;
          last_seen_at?: string;
          maps_url?: string | null;
          name?: string;
          price?: string | null;
          search_vector?: unknown;
          services?: Json;
          source_count?: number;
          source_excerpt?: string | null;
          source_name?: string | null;
          source_url?: string;
          summary?: string | null;
          updated_at?: string;
          verification_status?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      wedding_rsvps: {
        Row: {
          ceremonies: Json;
          created_at: string;
          email: string | null;
          guest_count: number;
          id: string;
          message: string | null;
          name: string;
          phone: string | null;
          response: string;
          updated_at: string;
          website_id: string;
        };
        Insert: {
          ceremonies?: Json;
          created_at?: string;
          email?: string | null;
          guest_count?: number;
          id?: string;
          message?: string | null;
          name: string;
          phone?: string | null;
          response: string;
          updated_at?: string;
          website_id: string;
        };
        Update: {
          ceremonies?: Json;
          created_at?: string;
          email?: string | null;
          guest_count?: number;
          id?: string;
          message?: string | null;
          name?: string;
          phone?: string | null;
          response?: string;
          updated_at?: string;
          website_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wedding_rsvps_website_id_fkey";
            columns: ["website_id"];
            isOneToOne: false;
            referencedRelation: "wedding_websites";
            referencedColumns: ["id"];
          },
        ];
      };
      website_custom_requests: {
        Row: {
          admin_note: string | null;
          brief: string;
          contact_preference: "email" | "phone" | "whatsapp";
          contact_value: string;
          created_at: string;
          id: string;
          request_title: string;
          status: "new" | "in_review" | "in_progress" | "completed";
          updated_at: string;
          user_id: string;
          website_id: string | null;
        };
        Insert: {
          admin_note?: string | null;
          brief: string;
          contact_preference?: "email" | "phone" | "whatsapp";
          contact_value: string;
          created_at?: string;
          id?: string;
          request_title: string;
          status?: "new" | "in_review" | "in_progress" | "completed";
          updated_at?: string;
          user_id: string;
          website_id?: string | null;
        };
        Update: {
          admin_note?: string | null;
          brief?: string;
          contact_preference?: "email" | "phone" | "whatsapp";
          contact_value?: string;
          created_at?: string;
          id?: string;
          request_title?: string;
          status?: "new" | "in_review" | "in_progress" | "completed";
          updated_at?: string;
          user_id?: string;
          website_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "website_custom_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "website_custom_requests_website_id_fkey";
            columns: ["website_id"];
            isOneToOne: false;
            referencedRelation: "wedding_websites";
            referencedColumns: ["id"];
          },
        ];
      };
      wedding_websites: {
        Row: {
          card_design: string;
          ceremonies: Json;
          couple_story: string;
          created_at: string;
          hero_image_url: string | null;
          id: string;
          published: boolean;
          slug: string;
          title: string;
          updated_at: string;
          user_id: string;
          welcome_message: string;
        };
        Insert: {
          card_design?: string;
          ceremonies?: Json;
          couple_story?: string;
          created_at?: string;
          hero_image_url?: string | null;
          id?: string;
          published?: boolean;
          slug: string;
          title: string;
          updated_at?: string;
          user_id: string;
          welcome_message?: string;
        };
        Update: {
          card_design?: string;
          ceremonies?: Json;
          couple_story?: string;
          created_at?: string;
          hero_image_url?: string | null;
          id?: string;
          published?: boolean;
          slug?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
          welcome_message?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      activate_my_subscription_trial: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      consume_subscription_quota: {
        Args: { p_feature: string; p_units?: number };
        Returns: {
          allowed: boolean;
          event_id: string | null;
          included_units: number;
          resets_at: string;
          used_units: number;
        }[];
      };
      finalize_ai_usage: {
        Args: { p_event_id: string; p_input_tokens: number; p_output_tokens: number };
        Returns: undefined;
      };
      get_subscription_usage: {
        Args: Record<PropertyKey, never>;
        Returns: {
          estimated_cost_paise: number;
          feature: "ai_planner" | "vendor_research" | "whatsapp_send" | "voice_call";
          included_units: number;
          used_units: number;
        }[];
      };
      claim_scrape_job: {
        Args: never;
        Returns: {
          attempted_at: string | null;
          completed_at: string | null;
          created_at: string;
          documents_created: number;
          documents_updated: number;
          error: string | null;
          id: string;
          owner_id: string;
          source_id: string;
          status: Database["public"]["Enums"]["scrape_job_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "scrape_jobs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      search_documents: {
        Args: {
          p_from?: string;
          p_limit?: number;
          p_offset?: number;
          p_owner_id: string;
          p_query: string;
          p_source_ids?: string[];
          p_to?: string;
        };
        Returns: {
          canonical_url: string;
          description: string;
          id: string;
          published_at: string;
          rank: number;
          snippet: string;
          source_id: string;
          source_name: string;
          title: string;
          total_count: number;
          url: string;
        }[];
      };
      search_vendor_directory: {
        Args: { p_limit?: number; p_query: string };
        Returns: {
          address: string;
          capacity: string;
          category: string;
          city: string;
          contact_email: string;
          contact_phone: string;
          id: string;
          image_url: string;
          last_seen_at: string;
          maps_url: string;
          name: string;
          price: string;
          rank: number;
          services: Json;
          source_excerpt: string;
          source_name: string;
          source_url: string;
          summary: string;
          verification_status: string;
          website: string;
        }[];
      };
    };
    Enums: {
      app_role: "couple" | "vendor" | "admin";
      scrape_job_status: "queued" | "running" | "completed" | "failed" | "cancelled";
      source_kind: "web" | "rss" | "web_search" | "manual";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["couple", "vendor", "admin"],
      scrape_job_status: ["queued", "running", "completed", "failed", "cancelled"],
      source_kind: ["web", "rss", "web_search", "manual"],
    },
  },
} as const;
