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
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Inserts<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Updates<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
