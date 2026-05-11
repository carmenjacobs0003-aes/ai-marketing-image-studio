import { CommunityGallery } from "@/components/gallery/community-gallery";
import { listPublicGalleryItems } from "@/lib/gallery/db";
import type { GalleryItem, GallerySort } from "@/lib/gallery/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TypedSupabaseClient } from "@/lib/db/helpers";
import { createSignedImageUrl } from "@/lib/storage/images";

const validSorts = new Set(["featured", "trending", "newest"]);

type GalleryPageProps = {
  searchParams: {
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
  };
};

async function signGalleryItems(items: GalleryItem[]) {
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      signedUrl: item.image_storage_path
        ? await createSignedImageUrl(item.image_storage_path).catch(() => null)
        : null
    }))
  );
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Community Gallery | AI Marketing Image Studio",
  description: "Browse reusable AI images, marketing generations, prompts, and creator profiles."
};

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const supabase = createSupabaseAdminClient() as unknown as TypedSupabaseClient;
  const sort = validSorts.has(searchParams.sort ?? "") ? (searchParams.sort as GallerySort) : "featured";
  const page = Number(searchParams.page ?? "1");

  const [main, featured, trending, newest] = await Promise.all([
    listPublicGalleryItems(supabase, { query: searchParams.q, category: searchParams.category, sort, page, pageSize: 12 }),
    listPublicGalleryItems(supabase, { sort: "featured", pageSize: 3 }),
    listPublicGalleryItems(supabase, { sort: "trending", pageSize: 3 }),
    listPublicGalleryItems(supabase, { sort: "newest", pageSize: 3 })
  ]);

  const [items, featuredItems, trendingItems, newestItems] = await Promise.all([
    signGalleryItems(main.items),
    signGalleryItems(featured.items),
    signGalleryItems(trending.items),
    signGalleryItems(newest.items)
  ]);

  return (
    <CommunityGallery
      featuredItems={featuredItems}
      hasMore={main.hasMore}
      initialCategory={searchParams.category ?? ""}
      initialQuery={searchParams.q ?? ""}
      initialSort={sort}
      items={items}
      newestItems={newestItems}
      page={main.page}
      total={main.count}
      trendingItems={trendingItems}
    />
  );
}
