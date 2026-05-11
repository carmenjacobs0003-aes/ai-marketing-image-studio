import type { TypedSupabaseClient } from "@/lib/db/helpers";
import type { AuditSeverity } from "@/lib/admin/types";

export async function logAdminAuditEvent(
  supabase: TypedSupabaseClient,
  input: {
    actorId?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    severity?: AuditSeverity;
    metadata?: Record<string, unknown>;
  }
) {
  await supabase.from("admin_audit_logs").insert({
    actor_id: input.actorId ?? null,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    severity: input.severity ?? "info",
    metadata: input.metadata ?? {}
  });
}
