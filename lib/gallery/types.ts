import type { Json } from "@/lib/db/types";

export type GalleryItemKind = "image" | "marketing";
export type GalleryVisibility = "public" | "private";
export type GallerySort = "featured" | "trending" | "newest";

export type GalleryCreator = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: "free" | "pro" | "agency";
};

export type GalleryItem = {
  id: string;
  creator_id: string;
  kind: GalleryItemKind;
  visibility: GalleryVisibility;
  title: string;
  description: string | null;
  prompt: string;
  reusable_prompt: string;
  category: string;
  tags: string[];
  image_storage_path: string | null;
  image_signed_url: string | null;
  marketing_output: Json;
  metadata: Json;
  featured: boolean;
  view_count: number;
  like_count: number;
  copy_count: number;
  remix_count: number;
  report_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  creator?: GalleryCreator | null;
  viewer_has_favorited?: boolean;
  signedUrl?: string | null;
};

export type GalleryListParams = {
  query?: string;
  category?: string;
  tag?: string;
  sort?: GallerySort;
  page?: number;
  pageSize?: number;
};
