import { requireDatabaseData, requireMutation, type TypedSupabaseClient } from "@/lib/db/helpers";
import type { GalleryItem, GalleryListParams, GallerySort } from "@/lib/gallery/types";

const DEFAULT_PAGE_SIZE = 12;

function normalizePage(page = 1) {
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 8);
}

function applySort(query: TypedSupabaseClient, sort: GallerySort) {
  if (sort === "featured") {
    return query.order("featured", { ascending: false }).order("published_at", { ascending: false });
  }
  if (sort === "trending") {
    return query.order("like_count", { ascending: false }).order("view_count", { ascending: false }).order("published_at", { ascending: false });
  }
  return query.order("published_at", { ascending: false });
}

export async function listPublicGalleryItems(supabase: TypedSupabaseClient, params: GalleryListParams = {}) {
  const page = normalizePage(params.page);
  const pageSize = Math.min(Math.max(params.pageSize ?? DEFAULT_PAGE_SIZE, 1), 48);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sort = params.sort ?? "featured";

  let query = supabase
    .from("gallery_items")
    .select("*", { count: "exact" })
    .eq("visibility", "public");

  if (params.query) {
    const term = params.query.trim().replaceAll("%", "");
    if (term) {
      query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%,prompt.ilike.%${term}%,category.ilike.%${term}%`);
    }
  }

  if (params.category) query = query.eq("category", params.category);
  if (params.tag) query = query.contains("tags", [params.tag.toLowerCase()]);

  const { data, error, count } = await applySort(query, sort).range(from, to);
  const items = requireDatabaseData(data, error, "Unable to load gallery") as GalleryItem[];
  const creatorIds = [...new Set(items.map((item) => item.creator_id))];
  if (creatorIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, plan")
      .in("id", creatorIds);
    const profilesById = new Map((profiles ?? []).map((profile: GalleryItem["creator"]) => [profile?.id, profile]));
    items.forEach((item) => {
      item.creator = (profilesById.get(item.creator_id) as GalleryItem["creator"]) ?? null;
    });
  }
  return {
    items,
    count: count ?? 0,
    page,
    pageSize,
    hasMore: (count ?? 0) > page * pageSize
  };
}

export async function listMyGalleryItems(supabase: TypedSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("gallery_items")
    .select("*")
    .eq("creator_id", userId)
    .order("created_at", { ascending: false })
    .limit(60);
  return requireDatabaseData(data, error, "Unable to load your gallery items") as GalleryItem[];
}

export async function getPublicGalleryItem(supabase: TypedSupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("gallery_items")
    .select("*")
    .eq("id", id)
    .eq("visibility", "public")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, plan")
    .eq("id", data.creator_id)
    .maybeSingle();
  return { ...(data as GalleryItem), creator: (profile as GalleryItem["creator"]) ?? null };
}

export async function createGalleryItem(supabase: TypedSupabaseClient, item: Record<string, unknown>) {
  const { data, error } = await supabase.from("gallery_items").insert(item).select("*").single();
  return requireDatabaseData(data, error, "Unable to publish gallery item") as GalleryItem;
}

export async function updateGalleryItemVisibility(supabase: TypedSupabaseClient, id: string, userId: string, visibility: "public" | "private") {
  const { data, error } = await supabase
    .from("gallery_items")
    .update({ visibility, published_at: visibility === "public" ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("creator_id", userId)
    .select("*")
    .single();
  return requireDatabaseData(data, error, "Unable to update gallery visibility") as GalleryItem;
}

export async function toggleGalleryFavorite(supabase: TypedSupabaseClient, userId: string, itemId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("gallery_favorites")
    .select("gallery_item_id")
    .eq("user_id", userId)
    .eq("gallery_item_id", itemId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabase.from("gallery_favorites").delete().eq("user_id", userId).eq("gallery_item_id", itemId);
    requireMutation(error, "Unable to remove favorite");
    await supabase.rpc("increment_gallery_like", { p_gallery_item_id: itemId, p_quantity: -1 }).catch(() => null);
    return { favorited: false };
  }

  const { error } = await supabase.from("gallery_favorites").insert({ user_id: userId, gallery_item_id: itemId });
  requireMutation(error, "Unable to favorite gallery item");
  await supabase.rpc("increment_gallery_like", { p_gallery_item_id: itemId, p_quantity: 1 }).catch(() => null);
  return { favorited: true };
}

export async function incrementGalleryMetric(supabase: TypedSupabaseClient, itemId: string, metric: "view" | "copy" | "remix") {
  const { data, error } = await supabase.rpc("increment_gallery_metric", { p_gallery_item_id: itemId, p_metric: metric, p_quantity: 1 });
  return requireDatabaseData(data, error, "Unable to update gallery metric") as GalleryItem;
}

export async function reportGalleryItem(supabase: TypedSupabaseClient, input: { itemId: string; reporterId: string; reason: string; details?: string | null }) {
  const { data, error } = await supabase.from("gallery_reports").insert({ gallery_item_id: input.itemId, reporter_id: input.reporterId, reason: input.reason, details: input.details ?? null }).select("*").single();
  return requireDatabaseData(data, error, "Unable to report gallery item");
}
