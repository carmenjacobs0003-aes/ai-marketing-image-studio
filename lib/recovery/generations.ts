import type { TypedSupabaseClient } from "@/lib/db/helpers";

const GENERATION_RECOVERY_TABLES = [
  "image_generations",
  "marketing_generations"
] as const;

export type GenerationRecoveryTable =
  (typeof GENERATION_RECOVERY_TABLES)[number];

export type GenerationRecoveryResult = {
  table: GenerationRecoveryTable;
  recovered: number;
};

export type RecoverStaleGenerationsOptions = {
  cutoffMinutes?: number;
  userId?: string;
  now?: Date;
};

export function getGenerationRecoveryCutoffMinutes() {
  const cutoffMinutes = Number(process.env.RECOVERY_CUTOFF_MINUTES ?? 20);

  return Number.isFinite(cutoffMinutes) && cutoffMinutes > 0
    ? cutoffMinutes
    : 20;
}

export async function recoverStaleGenerations(
  supabase: TypedSupabaseClient,
  options: RecoverStaleGenerationsOptions = {}
): Promise<GenerationRecoveryResult[]> {
  const cutoffMinutes =
    options.cutoffMinutes ?? getGenerationRecoveryCutoffMinutes();
  const cutoff = new Date(
    (options.now ?? new Date()).getTime() - cutoffMinutes * 60_000
  ).toISOString();
  const updates = {
    status: "failed",
    error_message: `Recovered stale job after ${cutoffMinutes} minutes. Please retry.`,
    updated_at: new Date().toISOString()
  };

  const results: GenerationRecoveryResult[] = [];

  for (const table of GENERATION_RECOVERY_TABLES) {
    let query = supabase
      .from(table)
      .update(updates, { count: "exact" })
      .in("status", ["queued", "processing"])
      .lt("updated_at", cutoff);

    if (options.userId) {
      query = query.eq("user_id", options.userId);
    }

    const { error, count } = await query;

    if (error) {
      throw error;
    }

    results.push({ table, recovered: count ?? 0 });
  }

  return results;
}
