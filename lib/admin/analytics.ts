import { env } from "@/lib/env";
import { billingPlans } from "@/lib/billing/plans";
import type { TypedSupabaseClient } from "@/lib/db/helpers";
import type {
  AdminDashboardData,
  AdminMetric,
  AuditLog,
  DailyGenerationPoint,
  GalleryAdminItem,
  GenerationHealth,
  ModerationReport
} from "@/lib/admin/types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_DAYS = 30;

function isoDateDaysAgo(daysAgo: number) {
  return new Date(Date.now() - daysAgo * DAY_IN_MS).toISOString().slice(0, 10);
}

function isoTimestampDaysAgo(daysAgo: number) {
  return new Date(Date.now() - daysAgo * DAY_IN_MS).toISOString();
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function parseMonthlyPrice(price: string) {
  const parsed = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPlanPrice(plan: string) {
  const match = billingPlans.find((item) => item.id === plan);
  return match ? parseMonthlyPrice(match.price) : 0;
}

async function getCount(supabase: TypedSupabaseClient, table: string, apply?: (query: TypedSupabaseClient) => TypedSupabaseClient) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (apply) query = apply(query);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

export async function getPlatformAnalytics(supabase: TypedSupabaseClient): Promise<AdminDashboardData> {
  const thirtyDaysAgo = isoTimestampDaysAgo(ACTIVE_WINDOW_DAYS);
  const twoWeeksAgoDate = isoDateDaysAgo(13);
  const oneDayAgo = isoTimestampDaysAgo(1);

  const [
    totalUsers,
    activeUsers,
    activeSubscriptions,
    imageGenerationCount,
    galleryUploads,
    openReports,
    removedItems,
    dailyUsageResult,
    usersResult,
    profilesForRevenueResult,
    reportsResult,
    galleryResult,
    auditResult,
    marketingHealthResult,
    imageHealthResult
  ] = await Promise.all([
    getCount(supabase, "profiles"),
    getCount(supabase, "profiles", (query) => query.gte("last_active_at", thirtyDaysAgo)),
    getCount(supabase, "profiles", (query) => query.in("subscription_status", ["active", "approval_pending"]).in("plan", ["pro", "agency"])),
    getCount(supabase, "image_generations"),
    getCount(supabase, "gallery_items"),
    getCount(supabase, "gallery_reports", (query) => query.in("status", ["open", "reviewing"])),
    getCount(supabase, "gallery_items", (query) => query.eq("moderation_status", "removed")),
    supabase.from("daily_usage").select("usage_date,marketing_generations,image_generations").gte("usage_date", twoWeeksAgoDate).order("usage_date", { ascending: true }),
    supabase.from("profiles").select("id,email,full_name,plan,subscription_status,subscription_current_period_end,created_at,updated_at,admin_role,creator_verified,moderation_status,last_active_at").order("created_at", { ascending: false }).limit(24),
    supabase.from("profiles").select("plan,subscription_status"),
    supabase.from("gallery_reports").select("id,gallery_item_id,reporter_id,reason,details,status,created_at,updated_at,gallery_item:gallery_items(id,title,visibility,featured,creator_id,moderation_status,removed_at)").order("created_at", { ascending: false }).limit(24),
    supabase.from("gallery_items").select("id,title,category,visibility,featured,creator_id,report_count,like_count,view_count,published_at,created_at,moderation_status,removed_at").order("report_count", { ascending: false }).order("created_at", { ascending: false }).limit(24),
    supabase.from("admin_audit_logs").select("id,actor_id,action,target_type,target_id,severity,metadata,created_at").order("created_at", { ascending: false }).limit(18),
    supabase.from("marketing_generations").select("id,prompt,status,error_message,created_at").gte("created_at", thirtyDaysAgo).order("created_at", { ascending: false }).limit(500),
    supabase.from("image_generations").select("id,prompt,status,error_message,created_at").gte("created_at", thirtyDaysAgo).order("created_at", { ascending: false }).limit(500)
  ]);

  const dailyRows = dailyUsageResult.data ?? [];
  const dailyMap = new Map<string, DailyGenerationPoint>();
  for (let index = 13; index >= 0; index -= 1) {
    const date = isoDateDaysAgo(index);
    dailyMap.set(date, { date, marketing: 0, image: 0, total: 0 });
  }
  for (const row of dailyRows) {
    const point = dailyMap.get(row.usage_date) ?? { date: row.usage_date, marketing: 0, image: 0, total: 0 };
    point.marketing += row.marketing_generations ?? 0;
    point.image += row.image_generations ?? 0;
    point.total = point.marketing + point.image;
    dailyMap.set(row.usage_date, point);
  }
  const dailyGenerations = [...dailyMap.values()];
  const totalGenerations = dailyGenerations.reduce((sum, point) => sum + point.total, 0);
  const generationsToday = dailyGenerations.at(-1)?.total ?? 0;

  const revenueEstimate = (profilesForRevenueResult.data ?? []).reduce((sum: number, profile: { plan: string; subscription_status: string }) => {
    if (profile.subscription_status !== "active") return sum;
    return sum + getPlanPrice(profile.plan);
  }, 0);

  const generationHealth = buildGenerationHealth(marketingHealthResult.data ?? [], imageHealthResult.data ?? []);

  const metrics: AdminMetric[] = [
    { label: "Total users", value: formatNumber(totalUsers), detail: `${formatNumber(activeUsers)} active in ${ACTIVE_WINDOW_DAYS} days`, tone: "cyan" },
    { label: "Active users", value: formatNumber(activeUsers), detail: `${totalUsers ? Math.round((activeUsers / totalUsers) * 100) : 0}% of registered accounts`, tone: "green" },
    { label: "Subscriptions", value: formatNumber(activeSubscriptions), detail: "Paid PayPal plans currently active/pending", tone: "cyan" },
    { label: "Generations/day", value: formatNumber(generationsToday), detail: `${formatNumber(totalGenerations)} over the last 14 days`, tone: "amber" },
    { label: "Image generations", value: formatNumber(imageGenerationCount), detail: "All-time generated image records", tone: "cyan" },
    { label: "Gallery uploads", value: formatNumber(galleryUploads), detail: `${formatNumber(removedItems)} removed by moderation`, tone: "green" },
    { label: "Revenue estimate", value: formatCurrency(revenueEstimate), detail: "Estimated monthly recurring revenue", tone: "cyan" },
    { label: "Open reports", value: formatNumber(openReports), detail: "Moderation reports requiring review", tone: openReports > 0 ? "rose" : "green" }
  ];

  const systemHealth: AdminMetric[] = [
    { label: "API health", value: "Online", detail: "Next.js route handlers are serving admin telemetry", tone: "green" },
    { label: "Supabase", value: env.NEXT_PUBLIC_SUPABASE_URL ? "Configured" : "Missing", detail: "Database and auth connection", tone: env.NEXT_PUBLIC_SUPABASE_URL ? "green" : "rose" },
    { label: "OpenAI", value: env.OPENAI_API_KEY ? "Configured" : "Missing", detail: "Generation provider key", tone: env.OPENAI_API_KEY ? "green" : "amber" },
    { label: "PayPal", value: env.PAYPAL_CLIENT_ID ? "Configured" : "Missing", detail: "Subscription billing integration", tone: env.PAYPAL_CLIENT_ID ? "green" : "amber" },
    { label: "24h errors", value: formatNumber(generationHealth.recentErrors.filter((error) => error.created_at >= oneDayAgo).length), detail: `${generationHealth.errorRate}% 30-day generation error rate`, tone: generationHealth.errorRate > 10 ? "rose" : "green" }
  ];

  return {
    metrics,
    dailyGenerations,
    users: (usersResult.data ?? []) as AdminDashboardData["users"],
    reports: normalizeReports(reportsResult.data ?? []),
    galleryItems: (galleryResult.data ?? []) as GalleryAdminItem[],
    auditLogs: (auditResult.data ?? []) as AuditLog[],
    generationHealth,
    systemHealth
  };
}

type GenerationSample = { id: string; prompt: string | null; status: string | null; error_message: string | null; created_at: string | null };

function buildGenerationHealth(marketingRows: GenerationSample[], imageRows: GenerationSample[]): GenerationHealth {
  const combined: Array<GenerationSample & { kind: "marketing" | "image" }> = [
    ...marketingRows.map((row) => ({ ...row, kind: "marketing" as const })),
    ...imageRows.map((row) => ({ ...row, kind: "image" as const }))
  ];
  const total = combined.length;
  const completed = combined.filter((row) => row.status === "completed").length;
  const failed = combined.filter((row) => row.status === "failed").length;
  const queued = combined.filter((row) => row.status === "queued").length;
  const processing = combined.filter((row) => row.status === "processing").length;
  const recentErrors = combined
    .filter((row) => row.status === "failed")
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 8)
    .map((row) => ({ id: String(row.id), kind: row.kind, prompt: String(row.prompt ?? ""), error_message: row.error_message, created_at: String(row.created_at) }));

  return {
    total,
    completed,
    failed,
    queued,
    processing,
    successRate: total ? Math.round((completed / total) * 100) : 100,
    errorRate: total ? Math.round((failed / total) * 100) : 0,
    recentErrors
  };
}

function normalizeReports(rows: unknown[]): ModerationReport[] {
  return rows.map((row) => {
    const report = row as ModerationReport & { gallery_item?: ModerationReport["gallery_item"] | ModerationReport["gallery_item"][] };
    const galleryItem = Array.isArray(report.gallery_item) ? report.gallery_item[0] ?? null : report.gallery_item ?? null;
    return { ...report, gallery_item: galleryItem };
  });
}
