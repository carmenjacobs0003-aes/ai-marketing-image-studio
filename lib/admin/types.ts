import type { AppPlan } from "@/lib/db/types";

export type AdminRole = "user" | "moderator" | "admin";
export type ModerationStatus = "clean" | "flagged" | "removed";
export type AuditSeverity = "info" | "warning" | "critical";

export type AdminProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  plan: AppPlan;
  subscription_status: string;
  subscription_current_period_end: string | null;
  created_at: string;
  updated_at: string;
  admin_role: AdminRole;
  creator_verified: boolean;
  moderation_status: ModerationStatus;
  last_active_at: string | null;
};

export type AdminMetric = {
  label: string;
  value: string;
  detail: string;
  tone?: "cyan" | "green" | "amber" | "rose";
};

export type DailyGenerationPoint = {
  date: string;
  marketing: number;
  image: number;
  total: number;
};

export type GenerationHealth = {
  total: number;
  completed: number;
  failed: number;
  queued: number;
  processing: number;
  successRate: number;
  errorRate: number;
  recentErrors: Array<{
    id: string;
    kind: "marketing" | "image";
    prompt: string;
    error_message: string | null;
    created_at: string;
  }>;
};

export type ModerationReport = {
  id: string;
  gallery_item_id: string;
  reporter_id: string | null;
  reason: string;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  created_at: string;
  updated_at: string;
  gallery_item?: {
    id: string;
    title: string;
    visibility: "public" | "private";
    featured: boolean;
    creator_id: string;
    moderation_status?: ModerationStatus;
    removed_at?: string | null;
  } | null;
};

export type GalleryAdminItem = {
  id: string;
  title: string;
  category: string;
  visibility: "public" | "private";
  featured: boolean;
  creator_id: string;
  report_count: number;
  like_count: number;
  view_count: number;
  published_at: string | null;
  created_at: string;
  moderation_status?: ModerationStatus;
  removed_at?: string | null;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  severity: AuditSeverity;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type MonitoringIncident = {
  label: string;
  value: string;
  detail: string;
  severity: "info" | "warning" | "critical";
};

export type AdminDashboardData = {
  metrics: AdminMetric[];
  dailyGenerations: DailyGenerationPoint[];
  users: AdminProfile[];
  reports: ModerationReport[];
  galleryItems: GalleryAdminItem[];
  auditLogs: AuditLog[];
  generationHealth: GenerationHealth;
  systemHealth: AdminMetric[];
  monitoringIncidents: MonitoringIncident[];
};
