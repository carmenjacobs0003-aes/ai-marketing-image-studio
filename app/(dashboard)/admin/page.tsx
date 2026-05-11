import { revalidatePath } from "next/cache";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { getPlatformAnalytics } from "@/lib/admin/analytics";
import { logAdminAuditEvent } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TypedSupabaseClient } from "@/lib/db/helpers";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: {
    q?: string;
    status?: string;
  };
};

async function updateUserAction(formData: FormData) {
  "use server";

  const { user } = await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const adminDb = supabase as unknown as TypedSupabaseClient;
  const userId = String(formData.get("userId") ?? "");
  const intent = String(formData.get("intent") ?? "save");
  if (!userId) return;

  const updates: Record<string, unknown> = {};
  if (intent === "toggleVerification") {
    updates.creator_verified = formData.get("creatorVerified") === "true";
  } else {
    const plan = String(formData.get("plan") ?? "free");
    const adminRole = String(formData.get("adminRole") ?? "user");
    const subscriptionStatus = String(formData.get("subscriptionStatus") ?? "free");
    if (["free", "pro", "agency"].includes(plan)) updates.plan = plan;
    if (["free", "approval_pending", "active", "suspended", "cancelled", "expired", "past_due"].includes(subscriptionStatus)) updates.subscription_status = subscriptionStatus;
    if (["user", "moderator", "admin"].includes(adminRole)) updates.admin_role = adminRole;
  }

  if (!Object.keys(updates).length) return;

  await adminDb.from("profiles").update(updates).eq("id", userId);
  await logAdminAuditEvent(supabase, { actorId: user.id, action: `admin.user.${intent}`, targetType: "profile", targetId: userId, metadata: updates });
  revalidatePath("/admin");
}

async function updateReportAction(formData: FormData) {
  "use server";

  const { user } = await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const adminDb = supabase as unknown as TypedSupabaseClient;
  const reportId = String(formData.get("reportId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const intent = String(formData.get("intent") ?? "reviewing");
  if (!reportId) return;

  const status = ["reviewing", "resolved", "dismissed"].includes(intent) ? intent : "resolved";
  await adminDb.from("gallery_reports").update({ status }).eq("id", reportId);

  if (intent === "remove" && itemId) {
    await adminDb
      .from("gallery_items")
      .update({ visibility: "private", featured: false, moderation_status: "removed", removed_at: new Date().toISOString(), removed_by: user.id })
      .eq("id", itemId);
  }

  await logAdminAuditEvent(supabase, { actorId: user.id, action: `admin.report.${intent}`, targetType: "gallery_report", targetId: reportId, severity: intent === "remove" ? "warning" : "info", metadata: { itemId } });
  revalidatePath("/admin");
}

async function updateGalleryAction(formData: FormData) {
  "use server";

  const { user } = await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const adminDb = supabase as unknown as TypedSupabaseClient;
  const itemId = String(formData.get("itemId") ?? "");
  const intent = String(formData.get("intent") ?? "");
  if (!itemId) return;

  const updates: Record<string, unknown> = {};
  if (intent === "feature") updates.featured = true;
  if (intent === "unfeature") updates.featured = false;
  if (intent === "hide") updates.visibility = "private";
  if (intent === "restore") {
    updates.visibility = "public";
    updates.moderation_status = "clean";
    updates.removed_at = null;
    updates.removed_by = null;
  }
  if (intent === "remove") {
    updates.visibility = "private";
    updates.featured = false;
    updates.moderation_status = "removed";
    updates.removed_at = new Date().toISOString();
    updates.removed_by = user.id;
  }

  if (!Object.keys(updates).length) return;
  await adminDb.from("gallery_items").update(updates).eq("id", itemId);
  await logAdminAuditEvent(supabase, { actorId: user.id, action: `admin.gallery.${intent}`, targetType: "gallery_item", targetId: itemId, severity: intent === "remove" ? "warning" : "info", metadata: updates });
  revalidatePath("/admin");
}

export default async function AdminPage({ searchParams }: PageProps) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const data = await getPlatformAnalytics(supabase);

  return (
    <AdminDashboard
      data={data}
      query={searchParams?.q ?? ""}
      status={searchParams?.status ?? "all"}
      updateUserAction={updateUserAction}
      updateReportAction={updateReportAction}
      updateGalleryAction={updateGalleryAction}
    />
  );
}
