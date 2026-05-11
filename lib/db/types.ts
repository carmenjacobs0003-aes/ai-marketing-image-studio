export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppPlan = Database["public"]["Enums"]["app_plan"];
export type GenerationStatus = Database["public"]["Enums"]["generation_status"];
export type DailyUsageKind = "marketing_generations" | "image_generations";
export type AdminRole = Database["public"]["Enums"]["admin_role"];
export type ModerationStatus = Database["public"]["Enums"]["moderation_status"];
export type AuditSeverity = Database["public"]["Enums"]["audit_severity"];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          plan: "free" | "pro" | "agency";
          paypal_customer_id: string | null;
          paypal_subscription_id: string | null;
          paypal_plan_id: string | null;
          subscription_status:
            | "free"
            | "approval_pending"
            | "active"
            | "suspended"
            | "cancelled"
            | "expired"
            | "past_due";
          subscription_current_period_end: string | null;
          subscription_cancel_at: string | null;
          admin_role: "user" | "moderator" | "admin";
          creator_verified: boolean;
          moderation_status: "clean" | "flagged" | "removed";
          last_active_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          plan?: "free" | "pro" | "agency";
          paypal_customer_id?: string | null;
          paypal_subscription_id?: string | null;
          paypal_plan_id?: string | null;
          subscription_status?:
            | "free"
            | "approval_pending"
            | "active"
            | "suspended"
            | "cancelled"
            | "expired"
            | "past_due";
          subscription_current_period_end?: string | null;
          subscription_cancel_at?: string | null;
          admin_role?: "user" | "moderator" | "admin";
          creator_verified?: boolean;
          moderation_status?: "clean" | "flagged" | "removed";
          last_active_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          plan?: "free" | "pro" | "agency";
          paypal_customer_id?: string | null;
          paypal_subscription_id?: string | null;
          paypal_plan_id?: string | null;
          subscription_status?:
            | "free"
            | "approval_pending"
            | "active"
            | "suspended"
            | "cancelled"
            | "expired"
            | "past_due";
          subscription_current_period_end?: string | null;
          subscription_cancel_at?: string | null;
          admin_role?: "user" | "moderator" | "admin";
          creator_verified?: boolean;
          moderation_status?: "clean" | "flagged" | "removed";
          last_active_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      brand_kits: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          voice: string | null;
          tone: string | null;
          logo_url: string | null;
          colors: string[];
          fonts: string[];
          products: Json;
          guidelines: string | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          voice?: string | null;
          tone?: string | null;
          logo_url?: string | null;
          colors?: string[];
          fonts?: string[];
          products?: Json;
          guidelines?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          voice?: string | null;
          tone?: string | null;
          logo_url?: string | null;
          colors?: string[];
          fonts?: string[];
          products?: Json;
          guidelines?: string | null;
          is_default?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          brand_kit_id: string | null;
          name: string;
          description: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          brand_kit_id?: string | null;
          name: string;
          description?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          brand_kit_id?: string | null;
          name?: string;
          description?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      marketing_generations: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          brand_kit_id: string | null;
          prompt: string;
          content_type: string;
          model: string;
          output: Json;
          status: "queued" | "processing" | "completed" | "failed";
          error_message: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          brand_kit_id?: string | null;
          prompt: string;
          content_type: string;
          model: string;
          output?: Json;
          status?: "queued" | "processing" | "completed" | "failed";
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          project_id?: string | null;
          brand_kit_id?: string | null;
          status?: "queued" | "processing" | "completed" | "failed";
          output?: Json;
          error_message?: string | null;
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      image_generations: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          brand_kit_id: string | null;
          prompt: string;
          model: string;
          status: "queued" | "processing" | "completed" | "failed";
          storage_path: string | null;
          signed_url: string | null;
          error_message: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          brand_kit_id?: string | null;
          prompt: string;
          model: string;
          status?: "queued" | "processing" | "completed" | "failed";
          storage_path?: string | null;
          signed_url?: string | null;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          project_id?: string | null;
          brand_kit_id?: string | null;
          status?: "queued" | "processing" | "completed" | "failed";
          storage_path?: string | null;
          signed_url?: string | null;
          error_message?: string | null;
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_usage: {
        Row: {
          id: string;
          user_id: string;
          usage_date: string;
          marketing_generations: number;
          image_generations: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          usage_date?: string;
          marketing_generations?: number;
          image_generations?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          marketing_generations?: number;
          image_generations?: number;
          updated_at?: string;
        };
        Relationships: [];
      };

      gallery_items: {
        Row: {
          id: string;
          creator_id: string;
          source_image_generation_id: string | null;
          source_marketing_generation_id: string | null;
          kind: "image" | "marketing";
          visibility: "public" | "private";
          title: string;
          description: string | null;
          prompt: string;
          reusable_prompt: string;
          category: string;
          tags: string[];
          image_storage_path: string | null;
          image_signed_url: string | null;
          marketing_output: Json;
          metadata: Json;
          featured: boolean;
          view_count: number;
          like_count: number;
          copy_count: number;
          remix_count: number;
          report_count: number;
          moderation_status: "clean" | "flagged" | "removed";
          removed_at: string | null;
          removed_by: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          source_image_generation_id?: string | null;
          source_marketing_generation_id?: string | null;
          kind: "image" | "marketing";
          visibility?: "public" | "private";
          title: string;
          description?: string | null;
          prompt: string;
          reusable_prompt: string;
          category?: string;
          tags?: string[];
          image_storage_path?: string | null;
          image_signed_url?: string | null;
          marketing_output?: Json;
          metadata?: Json;
          featured?: boolean;
          view_count?: number;
          like_count?: number;
          copy_count?: number;
          remix_count?: number;
          report_count?: number;
          moderation_status?: "clean" | "flagged" | "removed";
          removed_at?: string | null;
          removed_by?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          visibility?: "public" | "private";
          title?: string;
          description?: string | null;
          reusable_prompt?: string;
          category?: string;
          tags?: string[];
          metadata?: Json;
          featured?: boolean;
          view_count?: number;
          like_count?: number;
          copy_count?: number;
          remix_count?: number;
          report_count?: number;
          moderation_status?: "clean" | "flagged" | "removed";
          removed_at?: string | null;
          removed_by?: string | null;
          published_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      gallery_favorites: {
        Row: { user_id: string; gallery_item_id: string; created_at: string };
        Insert: { user_id: string; gallery_item_id: string; created_at?: string };
        Update: { user_id?: string; gallery_item_id?: string; created_at?: string };
        Relationships: [];
      };
      gallery_reports: {
        Row: {
          id: string;
          gallery_item_id: string;
          reporter_id: string | null;
          reason: string;
          details: string | null;
          status: "open" | "reviewing" | "resolved" | "dismissed";
          handled_by: string | null;
          handled_at: string | null;
          resolution_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          gallery_item_id: string;
          reporter_id?: string | null;
          reason: string;
          details?: string | null;
          status?: "open" | "reviewing" | "resolved" | "dismissed";
          handled_by?: string | null;
          handled_at?: string | null;
          resolution_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          reason?: string;
          details?: string | null;
          status?: "open" | "reviewing" | "resolved" | "dismissed";
          handled_by?: string | null;
          handled_at?: string | null;
          resolution_note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      admin_audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          target_type: string;
          target_id: string | null;
          severity: "info" | "warning" | "critical";
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          target_type: string;
          target_id?: string | null;
          severity?: "info" | "warning" | "critical";
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          actor_id?: string | null;
          action?: string;
          target_type?: string;
          target_id?: string | null;
          severity?: "info" | "warning" | "critical";
          metadata?: Json;
        };
        Relationships: [];
      };
      paypal_webhook_events: {
        Row: {
          id: string;
          event_type: string;
          paypal_subscription_id: string | null;
          payload: Json;
          processed_at: string;
          created_at: string;
        };
        Insert: {
          id: string;
          event_type: string;
          paypal_subscription_id?: string | null;
          payload: Json;
          processed_at?: string;
          created_at?: string;
        };
        Update: {
          event_type?: string;
          paypal_subscription_id?: string | null;
          payload?: Json;
          processed_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_daily_usage: {
        Args: {
          p_user_id: string;
          p_usage_date: string;
          p_kind: DailyUsageKind;
          p_quantity?: number;
        };
        Returns: Database["public"]["Tables"]["daily_usage"]["Row"];
      };
      increment_gallery_metric: {
        Args: { p_gallery_item_id: string; p_metric: string; p_quantity?: number };
        Returns: Database["public"]["Tables"]["gallery_items"]["Row"];
      };
      increment_gallery_like: {
        Args: { p_gallery_item_id: string; p_quantity: number };
        Returns: Database["public"]["Tables"]["gallery_items"]["Row"];
      };
      sync_profile_subscription: {
        Args: {
          p_user_id: string;
          p_plan: "free" | "pro" | "agency";
          p_subscription_status:
            | "free"
            | "approval_pending"
            | "active"
            | "suspended"
            | "cancelled"
            | "expired"
            | "past_due";
          p_paypal_subscription_id?: string | null;
          p_paypal_plan_id?: string | null;
          p_paypal_customer_id?: string | null;
          p_current_period_end?: string | null;
          p_cancel_at?: string | null;
        };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
    };
    Enums: {
      app_plan: "free" | "pro" | "agency";
      generation_status: "queued" | "processing" | "completed" | "failed";
      gallery_item_kind: "image" | "marketing";
      gallery_visibility: "public" | "private";
      gallery_report_status: "open" | "reviewing" | "resolved" | "dismissed";
      admin_role: "user" | "moderator" | "admin";
      moderation_status: "clean" | "flagged" | "removed";
      audit_severity: "info" | "warning" | "critical";
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Inserts<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Updates<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
