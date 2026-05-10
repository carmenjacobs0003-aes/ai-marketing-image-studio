import type {
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

export async function listBrandKits(
  supabase: TypedSupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("brand_kits")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  return requireDatabaseData(data, error, "Unable to load brand kits");
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

export async function listProjects(
  supabase: TypedSupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return requireDatabaseData(data, error, "Unable to load projects");
}

export async function createProject(
  supabase: TypedSupabaseClient,
  project: Inserts<"projects">
) {
  const { data, error } = await supabase
    .from("projects")
    .insert(project)
    .select("*")
    .single();

  return requireDatabaseData(data, error, "Unable to create project");
}

export async function countProjects(
  supabase: TypedSupabaseClient,
  userId: string
) {
  const { count, error } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function createImageGeneration(
  supabase: TypedSupabaseClient,
  generation: Inserts<"image_generations">
) {
  const { data, error } = await supabase
    .from("image_generations")
    .insert(generation)
    .select("*")
    .single();

  return requireDatabaseData(data, error, "Unable to create image generation");
}

export async function updateImageGeneration(
  supabase: TypedSupabaseClient,
  id: string,
  userId: string,
  updates: Updates<"image_generations">
) {
  const { data, error } = await supabase
    .from("image_generations")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  return requireDatabaseData(data, error, "Unable to update image generation");
}

export async function listImageGenerations(
  supabase: TypedSupabaseClient,
  userId: string,
  limit = 24
) {
  const { data, error } = await supabase
    .from("image_generations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return requireDatabaseData(data, error, "Unable to load image generations");
}

export async function createMarketingGeneration(
  supabase: TypedSupabaseClient,
  generation: Inserts<"marketing_generations">
) {
  const { data, error } = await supabase
    .from("marketing_generations")
    .insert(generation)
    .select("*")
    .single();

  return requireDatabaseData(
    data,
    error,
    "Unable to create marketing generation"
  );
}

export async function updateMarketingGeneration(
  supabase: TypedSupabaseClient,
  id: string,
  userId: string,
  updates: Updates<"marketing_generations">
) {
  const { data, error } = await supabase
    .from("marketing_generations")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  return requireDatabaseData(
    data,
    error,
    "Unable to update marketing generation"
  );
}

export async function listMarketingGenerations(
  supabase: TypedSupabaseClient,
  userId: string,
  limit = 12
) {
  const { data, error } = await supabase
    .from("marketing_generations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return requireDatabaseData(
    data,
    error,
    "Unable to load marketing generations"
  );
}

export async function getDailyUsage(
  supabase: TypedSupabaseClient,
  userId: string,
  usageDate = toIsoDate()
) {
  const { data, error } = await supabase
    .from("daily_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("usage_date", usageDate)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function incrementDailyUsage(
  supabase: TypedSupabaseClient,
  userId: string,
  kind: DailyUsageKind,
  quantity = 1,
  usageDate = toIsoDate()
) {
  const { data, error } = await supabase.rpc("increment_daily_usage", {
    p_user_id: userId,
    p_usage_date: usageDate,
    p_kind: kind,
    p_quantity: quantity
  });

  return requireDatabaseData(data, error, "Unable to update daily usage");
}

export function stringifyMarketingOutput(output: Json) {
  if (typeof output === "string") {
    return output;
  }

  if (
    output &&
    typeof output === "object" &&
    !Array.isArray(output) &&
    "text" in output &&
    typeof output.text === "string"
  ) {
    return output.text;
  }

  return JSON.stringify(output, null, 2);
}

export { requireMutation };
