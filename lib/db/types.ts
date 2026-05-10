export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          plan: "free" | "pro" | "team";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          plan?: "free" | "pro" | "team";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          plan?: "free" | "pro" | "team";
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          updated_at?: string;
        };
      };
      image_generations: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          prompt: string;
          model: string;
          status: "queued" | "processing" | "completed" | "failed";
          storage_path: string | null;
          error_message: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          prompt: string;
          model: string;
          status?: "queued" | "processing" | "completed" | "failed";
          storage_path?: string | null;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          project_id?: string | null;
          status?: "queued" | "processing" | "completed" | "failed";
          storage_path?: string | null;
          error_message?: string | null;
          metadata?: Json;
          updated_at?: string;
        };
      };
      usage_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: "image_generation" | "image_upload" | "api_request";
          quantity: number;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: "image_generation" | "image_upload" | "api_request";
          quantity?: number;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
      };
    };
    Views: {
      usage_totals_current_month: {
        Row: {
          user_id: string | null;
          event_type: "image_generation" | "image_upload" | "api_request" | null;
          total_quantity: number | null;
        };
      };
    };
    Functions: Record<string, never>;
    Enums: {
      app_plan: "free" | "pro" | "team";
      image_generation_status: "queued" | "processing" | "completed" | "failed";
      usage_event_type: "image_generation" | "image_upload" | "api_request";
    };
  };
};
