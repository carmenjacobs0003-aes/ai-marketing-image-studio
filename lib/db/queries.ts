import type {
  AppPlan,
  DailyUsageKind,
  Inserts,
  Json,
  Tables,
  Updates
} from "@/lib/db/types";
import {
  requireDatabaseData,
  requireMutation,
  toIsoDate,
  type TypedSupabaseClient
} from "@/lib/db/helpers";

export type Profile = Tables<"profiles">;
export type BrandKit = Tables<"brand_kits">;
export type Project = Tables<"projects">;
export type MarketingGeneration = Tables<"marketing_generations">;
export type ImageGeneration = Tables<"image_generations">;
export type DailyUsage = Tables<"daily_usage">;
export type PayPalWebhookEvent = Tables<"paypal_webhook_events">;

export async function getProfile(
  supabase: TypedSupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function upsertProfile(
  supabase: TypedSupabaseClient,
  profile: Inserts<"profiles">
) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "id" })
    .select("*")
    .single();

  return requireDatabaseData(data, error, "Unable to save profile");
}

export async function updateProfileSubscription() {
  return null as any;
}

export async function getProfileByPayPalSubscriptionId(
  supabase: TypedSupabaseClient,
  subscriptionId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("paypal_subscription_id", subscriptionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function recordPayPalWebhookEvent(
  supabase: TypedSupabaseClient,
  event: Inserts<"paypal_webhook_events">
) {
  const { data, error } = await supabase
    .from("paypal_webhook_events")
    .upsert(event, { onConflict: "id", ignoreDuplicates: true })
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function syncProfileSubscription() {
  return null as any;
}

export async function listBrandKits(
  supabase: TypedSupabaseClient,
  userId: string
): Promise<BrandKit[]> {
  const { data, error } = await supabase
    .from("brand_kits")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return requireDatabaseData(data, error, "Unable to load brand kits");
}

export async function clearDefaultBrandKits(
  supabase: TypedSupabaseClient,
  userId: string,
  exceptId?: string
) {
  let query = supabase
    .from("brand_kits")
    .update({})
    .eq("user_id", userId);

  if (exceptId) {
    query = query.neq("id", exceptId);
  }

  const { error } = await query;

  return requireMutation(error, "Unable to update default brand kits");
}

export async function createBrandKit(
  supabase: TypedSupabaseClient,
  brandKit: Inserts<"brand_kits">
) {
  const { data, error } = await supabase
    .from("brand_kits")
    .insert(brandKit)
    .select("*")
    .single();

  return requireDatabaseData(data, error, "Unable to create brand kit");
}

export async function updateBrandKit(
  supabase: TypedSupabaseClient,
  id: string,
  userId: string,
  updates: Updates<"brand_kits">
) {
  const { data, error } = await supabase
    .from("brand_kits")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  return requireDatabaseData(data, error, "Unable to update brand kit");
}

export async function deleteBrandKit(
  supabase: TypedSupabaseClient,
  id: string,
  userId: string
) {
  const { error } = await supabase
    .from("brand_kits")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return requireMutation(error, "Unable to delete brand kit");
}
