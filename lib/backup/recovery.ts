import { BRAND_NAME } from "@/lib/branding";
import { env, getRedisEnv } from "@/lib/env";
import { summarizeDiagnostics } from "@/lib/monitoring/diagnostics";

export type RecoveryStep = {
  title: string;
  command?: string;
  detail: string;
};

export function getDatabaseBackupGuidance(): RecoveryStep[] {
  const projectRef = env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
    : "<project-ref>";

  return [
    {
      title: "Schedule managed point-in-time recovery",
      detail:
        "Enable Supabase PITR for production and verify retention covers your launch rollback window."
    },
    {
      title: "Create an encrypted logical backup before launch",
      command: `supabase db dump --project-ref ${projectRef} --file backups/$(date +%F)-syntrix-ai.sql`,
      detail:
        "Run from a trusted workstation or CI job with Supabase credentials; store the dump in encrypted object storage."
    },
    {
      title: "Validate restore in a staging project",
      command:
        "psql $STAGING_DATABASE_URL < backups/<backup-file>.sql && npm run diagnostics",
      detail:
        "Never test restores against production; validate schema, RLS policies, and admin analytics in staging."
    },
    {
      title: "Recover stuck generation jobs",
      command: "npm run recovery:generations",
      detail:
        "Marks stale queued/processing jobs as failed so users can retry without duplicate quota charges."
    }
  ];
}

export function getRecoveryReadinessReport() {
  const diagnostics = summarizeDiagnostics();

  return {
    service: BRAND_NAME,
    generatedAt: new Date().toISOString(),
    diagnostics,
    backupGuidance: getDatabaseBackupGuidance(),
    launchReady: diagnostics.status !== "fail" && getRedisEnv(env).configured
  };
}
